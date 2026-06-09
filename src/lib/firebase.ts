import { initializeApp, setLogLevel } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  addDoc, 
  serverTimestamp, 
  Timestamp, 
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  getDocFromCache,
  getDocsFromCache,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Merged configuration with placeholder detection.
const isPlaceholder = (val: string | undefined) => !val || val.includes('MY_FIREBASE') || val === '';

const finalConfig = {
  apiKey: !isPlaceholder(firebaseConfig.apiKey) ? firebaseConfig.apiKey : import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: !isPlaceholder(firebaseConfig.authDomain) ? firebaseConfig.authDomain : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: !isPlaceholder(firebaseConfig.projectId) ? firebaseConfig.projectId : (import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0592321618"),
  storageBucket: !isPlaceholder(firebaseConfig.storageBucket) ? firebaseConfig.storageBucket : import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: !isPlaceholder(firebaseConfig.messagingSenderId) ? firebaseConfig.messagingSenderId : import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: !isPlaceholder(firebaseConfig.appId) ? firebaseConfig.appId : import.meta.env.VITE_FIREBASE_APP_ID,
  firestoreDatabaseId: !isPlaceholder(firebaseConfig.firestoreDatabaseId) ? firebaseConfig.firestoreDatabaseId : import.meta.env.VITE_FIREBASE_DATABASE_ID
};

console.log('[Firebase] Neural Link Config:', {
  project: finalConfig.projectId,
  database: finalConfig.firestoreDatabaseId || '(default)',
  isPlaceholder: isPlaceholder(finalConfig.projectId)
});

// Automatic project ID detection for AI Studio
// In most cases, we should trust the provisioned firebase-applet-config.json.
// We only switch if we are explicitly in a placeholder state.
if (isPlaceholder(finalConfig.projectId) && typeof window !== 'undefined') {
  const host = window.location.hostname;
  const aisMatch = host.match(/^(ais-(?:dev|pre)-[a-z0-9-]+)-\d+\./);
  if (aisMatch) {
    const detectedId = aisMatch[1];
    console.log(`[Firebase] Placeholder detected. Auto-assigning project ID from hostname: ${detectedId}`);
    finalConfig.projectId = detectedId;
    finalConfig.authDomain = `${detectedId}.firebaseapp.com`;
    finalConfig.storageBucket = `${detectedId}.firebasestorage.app`;
  }
}

// Initialize Firebase safely
let app;
try {
  app = initializeApp(isPlaceholder(finalConfig.projectId) ? { apiKey: "none", projectId: "none" } : finalConfig);
  setLogLevel('silent');
} catch (e) {
  console.error("[Firebase] Init fail:", e);
  app = initializeApp({ apiKey: "none", projectId: "none" });
}

export const auth = getAuth(app);
const databaseId = !isPlaceholder(finalConfig.firestoreDatabaseId) ? finalConfig.firestoreDatabaseId : undefined;
// Define a mutable reference for the firestore instance
export let db = getFirestore(app, (databaseId === "(default)" || databaseId === "default") ? undefined : databaseId);

/**
 * Neural Link Synchronization
 * Allows the client to align its database connection with the server's findings.
 */
export async function syncNeuralLink() {
  try {
    const response = await fetch('/api/health');
    const health = await response.json();
    
    if (health.databaseId && health.databaseId !== (databaseId || '(default)')) {
      console.warn(`[Firebase] Neural Link Mismatch. Server: ${health.databaseId}, Client: ${databaseId || '(default)'}. Re-aligning...`);
      const targetId = (health.databaseId === "(default)" || health.databaseId === "default") ? undefined : health.databaseId;
      db = getFirestore(app, targetId);
    }
  } catch (e) {
    console.warn('[Firebase] Neural link sync failed:', e);
  }
}

// Enable Offline Persistence for a smoother neural link
if (typeof window !== 'undefined') {
  /*
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('[Firebase] Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firebase] The current browser does not support all of the features required to enable persistence');
    }
  });
  */
}

/**
 * Resilient GetDoc helper.
 * Handles transient "offline" or network errors by preferring any available data.
 * Falls back to cache explicitly if network is unavailable.
 */
export async function resilientGetDoc(docRef: any, maxRetries = 3): Promise<any> {
  let delay = 500;
  for (let i = 0; i < maxRetries; i++) {
    try {
      // First attempt: standard getDoc (cache + network)
      return await getDoc(docRef);
    } catch (e: any) {
      const errorMsg = e.message?.toLowerCase() || "";
      const isOffline = errorMsg.includes("offline") || 
                        errorMsg.includes("unavailable") || 
                        e.code === 'unavailable' ||
                        e.code === 'failed-precondition';
      
      if (isOffline) {
        // Try cache immediately if we detect offline/connectivity issues
        try {
          return await getDocFromCache(docRef);
        } catch (cacheErr) {
          // If not even in cache, we continue retrying network if possible
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
            continue;
          }
        }
      }
      
      if (i < maxRetries - 1 && !isOffline) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      
      // Final attempt: if still failing and offline, we return a mock 'empty' snapshot 
      // rather than throwing a blocking error.
      if (i === maxRetries - 1) {
        console.info("[Firebase] Neural link idle. Serving empty-state for offline integrity.");
        return { id: docRef.id, exists: () => false, data: () => null };
      }
      throw e;
    }
  }
}

/**
 * Resilient GetDocs helper.
 * Handles transient network issues for collection queries.
 */
export async function resilientGetDocs(q: any, maxRetries = 3): Promise<any> {
  let delay = 500;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await getDocs(q);
    } catch (e: any) {
      const errorMsg = e.message?.toLowerCase() || "";
      const isOffline = errorMsg.includes("offline") || e.code === 'unavailable';
      
      if (isOffline) {
        try {
          return await getDocsFromCache(q);
        } catch (cacheErr) {
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
            continue;
          }
        }
      }

      if (i < maxRetries - 1 && !isOffline) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      
      if (i === maxRetries - 1) {
        return { docs: [], empty: true, size: 0 };
      }
      throw e;
    }
  }
}

// Proactive Link Warmup (Resolves 'client is offline' race conditions)
// We use getDoc (which handles cache/offline) instead of getDocFromServer for the probe
if (!isPlaceholder(finalConfig.projectId)) {
  const warmUp = async () => {
    try {
      await getDoc(doc(db, '_internal', 'auth_probe'));
    } catch (e: any) {
      // Silently consume warmup failures
    }
  };
  warmUp();
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Auth Helpers
export const signInWithGoogle = () => {
  return signInWithPopup(auth, googleProvider);
};

export const signInAnonymous = () => {
  return signInAnonymously(auth);
};
export const signOut = () => auth.signOut();

// Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowMsg = errorMessage.toLowerCase();
  
  // Ignore benign idle stream timeouts and transient network errors 
  if (
    lowMsg.includes('disconnecting idle stream') || 
    lowMsg.includes('cancelled') ||
    lowMsg.includes('auth/network-request-failed') ||
    lowMsg.includes('network-request-failed') ||
    lowMsg.includes('code=unavailable') ||
    lowMsg.includes('offline') ||
    lowMsg.includes('unavailable') ||
    lowMsg.includes('fetching auth token failed')
  ) {
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // Only log for permission denied errors to avoid white screen during boot
  if (errorMessage.includes('Missing or insufficient permissions') || errorMessage.includes('permission-denied')) {
    if (path === 'intelligence') {
      console.warn('[Firebase] Intelligence feed delayed (access-syncing). Neural link will retry.');
      return;
    }
    console.error('Permission Denied Error (Suppressed for boot):', JSON.stringify(errInfo));
    // throw new Error(JSON.stringify(errInfo));
  }
}

// Types
export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp?: any;
  index?: number;
  hash?: string;
  previousHash?: string;
}

export interface IntelligenceItem {
  id?: string;
  source: string;
  content: string;
  timestamp: string;
  isBroadcasted?: boolean;
  explanationId?: string;
  metadata?: any;
}

export interface Tweet {
  id?: string;
  tweetId: string;
  author: string;
  text: string;
  timestamp: string;
  processed: boolean;
  userApproved?: boolean;
  draftRebuttal?: string;
  draftLogic?: string;
}

export interface AgentResponse {
  id?: string;
  targetId: string;
  responseText: string;
  counterTweet?: string;
  status: 'pending' | 'posted' | 'failed';
  timestamp: string;
}

export interface AgentLog {
  id?: string;
  agentName: string;
  action: string;
  status: string;
  timestamp: string;
}
