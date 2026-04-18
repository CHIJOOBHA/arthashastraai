import { initializeApp, setLogLevel } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, setDoc, onSnapshot, query, orderBy, limit, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Merged configuration with placeholder detection.
const isPlaceholder = (val: string | undefined) => !val || val.includes('MY_FIREBASE') || val === '';

const finalConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId
};

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
export const db = getFirestore(app, !isPlaceholder(finalConfig.firestoreDatabaseId) ? finalConfig.firestoreDatabaseId : undefined);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Auth Helpers
export const signInWithGoogle = () => {
  return signInWithPopup(auth, googleProvider);
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
  
  // Ignore benign idle stream timeouts and transient network errors which are handled automatically by the SDK
  if (
    errorMessage.includes('Disconnecting idle stream') || 
    errorMessage.includes('CANCELLED') ||
    errorMessage.includes('auth/network-request-failed') ||
    errorMessage.includes('network-request-failed') ||
    errorMessage.includes('code=unavailable') ||
    errorMessage.includes('offline') ||
    errorMessage.includes('Fetching auth token failed')
  ) {
    console.warn('Transient Firestore/Auth network error ignored:', errorMessage);
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
  metadata?: any;
}

export interface Tweet {
  id?: string;
  tweetId: string;
  author: string;
  text: string;
  timestamp: string;
  processed: boolean;
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
