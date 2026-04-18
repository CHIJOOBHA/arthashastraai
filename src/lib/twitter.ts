import { TwitterApi } from 'twitter-api-v2';
import { getEnv } from './env.js';

let twitterClientReadWrite: TwitterApi | null = null;

export const getTwitterClient = async (db?: any) => {
  if (twitterClientReadWrite) return twitterClientReadWrite;

  // Level 1: Environment Variables (Direct Access)
  const apiKey = getEnv("TWITTER_API_KEY");
  const apiSecret = getEnv("TWITTER_API_SECRET");
  const accessToken = getEnv("TWITTER_ACCESS_TOKEN");
  const accessSecret = getEnv("TWITTER_ACCESS_SECRET");

  if (apiKey && apiSecret && accessToken && accessSecret) {
    twitterClientReadWrite = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken: accessToken,
      accessSecret: accessSecret,
    });
    return twitterClientReadWrite;
  }

  // Level 2: OAuth 2.0 Tokens from Firestore
  const clientId = getEnv("TWITTER_CLIENT_ID");
  if (db && clientId) {
    try {
      let twitterDoc;
      if (typeof db.collection === 'function') {
        twitterDoc = await db.collection("config").doc("twitter").get();
      } else {
        const { doc, getDoc, collection } = await import("firebase/firestore");
        twitterDoc = await getDoc(doc(db, "config", "twitter"));
      }

      const exists = typeof twitterDoc.exists === 'function' ? twitterDoc.exists() : twitterDoc.exists;
      if (twitterDoc && exists) {
        const data = twitterDoc.data();
        if (data.accessToken) {
          // Check if expired
          const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
          const now = new Date();
          
          if (expiresAt && now >= expiresAt && data.refreshToken) {
            console.log("[Twitter] Token expired, attempting refresh...");
            const client = new TwitterApi({ 
              clientId: clientId, 
              clientSecret: getEnv("TWITTER_CLIENT_SECRET")
            });
            const { accessToken, refreshToken, expiresIn } = await client.refreshOAuth2Token(data.refreshToken);
            
            // Save new tokens
            const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
            if (typeof db.collection === 'function') {
              await db.collection("config").doc("twitter").update({
                accessToken,
                refreshToken,
                expiresAt: newExpiresAt,
                updatedAt: new Date().toISOString()
              });
            } else {
              const { doc, updateDoc } = await import("firebase/firestore");
              await updateDoc(doc(db, "config", "twitter"), {
                accessToken,
                refreshToken,
                expiresAt: newExpiresAt,
                updatedAt: new Date().toISOString()
              });
            }
            twitterClientReadWrite = new TwitterApi(accessToken);
          } else {
            twitterClientReadWrite = new TwitterApi(data.accessToken);
          }
          return twitterClientReadWrite;
        }
      }
    } catch (e) {
      console.warn("[Twitter] Failed to manage tokens from Firestore:", e);
    }
  }

  return null;
};

export async function postTruthTweet(text: string, db?: any, replyToId?: string) {
  const client = await getTwitterClient(db);
  if (!client) {
    console.warn("[Twitter] API Credentials missing. Tweet skipped (simulating).");
    return { success: false, reason: "missing_credentials", simulated: true };
  }

  try {
    const payload: any = { text };
    if (replyToId) {
      payload.reply = { in_reply_to_tweet_id: replyToId };
    }
    
    const tweet = await client.v2.tweet(payload);
    console.log("[Twitter] Tweet posted successfully:", tweet.data.id);
    return { success: true, id: tweet.data.id };
  } catch (error) {
    console.error("[Twitter] Failed to post tweet:", error);
    throw error;
  }
}
