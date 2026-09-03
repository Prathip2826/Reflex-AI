import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  getDocFromServer,
} from 'firebase/firestore';
import type { JournalEntry, UserProfile } from '../types';
import firebaseConfigData from '../../firebase-applet-config.json';

// Firestore Operation Types & Error Handling (Firebase Skill Standard)
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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Initialize Firebase
const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
  measurementId: firebaseConfigData.measurementId,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore with specific database ID if provided
export const db = firebaseConfigData.firestoreDatabaseId
  ? getFirestore(app, firebaseConfigData.firestoreDatabaseId)
  : getFirestore(app);

// Test Firestore Connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore is currently offline or connecting...');
      return false;
    }
    return true;
  }
}

// Helper: Strip undefined fields recursively to prevent Firestore driver errors
export function sanitizeFirestorePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (value === undefined) {
        return null;
      }
      return value;
    })
  );
}

// Convert Firebase User to App UserProfile
export function mapFirebaseUser(user: User | null): UserProfile | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || (user.isAnonymous ? 'Guest Explorer' : 'Journaler'),
    photoURL: user.photoURL || null,
    isAnonymous: user.isAnonymous,
  };
}

// Auth operations
export async function signInWithGoogle(): Promise<UserProfile | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const profile = mapFirebaseUser(result.user);
    if (!profile) throw new Error('User profile could not be loaded.');
    return profile;
  } catch (error: any) {
    // 1. User intentionally closed popup or cancelled: do NOT throw or log as a system error
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      // User closed the auth window voluntarily - cleanly return null
      return null;
    }

    // 2. Browser blocked popup window (e.g. restrictive iframe or popup blocker)
    if (error?.code === 'auth/popup-blocked') {
      console.warn('Google Sign-In popup was blocked by browser.');
      throw new Error(
        'Sign-in popup was blocked by your browser. Please allow popups or use the Anonymous Guest Session.'
      );
    }

    console.error('Google Sign-In Error:', error);
    throw new Error(error?.message || 'Failed to sign in with Google.');
  }
}

export async function signInGuest(): Promise<UserProfile> {
  try {
    const result = await signInAnonymously(auth);
    const profile = mapFirebaseUser(result.user);
    if (!profile) throw new Error('Guest session could not be established.');
    return profile;
  } catch (error: any) {
    console.error('Guest Sign-In Error:', error);
    throw new Error(error?.message || 'Failed to start guest session.');
  }
}

export async function signOutUser(): Promise<void> {
  await fbSignOut(auth);
}

export function subscribeToAuth(callback: (user: UserProfile | null) => void) {
  return onAuthStateChanged(auth, (user) => {
    callback(mapFirebaseUser(user));
  });
}

// Firestore operations scoped strictly to the current user
export async function saveJournalEntry(userId: string, entry: JournalEntry): Promise<void> {
  if (!userId) throw new Error('User ID is required to save entries.');
  if (!entry.id) throw new Error('Entry ID is required.');

  // Strict user isolation check
  if (entry.userId !== userId) {
    entry.userId = userId;
  }

  const cleanData = sanitizeFirestorePayload(entry);
  const entryPath = `users/${userId}/entries/${entry.id}`;
  const entryDocRef = doc(db, 'users', userId, 'entries', entry.id);

  try {
    await setDoc(entryDocRef, cleanData, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, entryPath);
  }

  // Also log interaction in interactions subcollection for audit / tracking
  try {
    const interactionPath = `users/${userId}/interactions/${entry.id}`;
    const interactionDocRef = doc(db, 'users', userId, 'interactions', entry.id);
    await setDoc(
      interactionDocRef,
      sanitizeFirestorePayload({
        entryId: entry.id,
        title: entry.title,
        mood: entry.mood,
        turnCount: entry.messages.length,
        lastUpdated: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('Optional interaction log write skipped:', err);
  }
}

export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) throw new Error('User ID and Entry ID are required.');
  const entryPath = `users/${userId}/entries/${entryId}`;
  const entryDocRef = doc(db, 'users', userId, 'entries', entryId);
  try {
    await deleteDoc(entryDocRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, entryPath);
  }
}

export function subscribeUserEntries(
  userId: string,
  onData: (entries: JournalEntry[]) => void,
  onError: (err: Error) => void
) {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const collectionPath = `users/${userId}/entries`;
  const entriesRef = collection(db, 'users', userId, 'entries');
  // Order by createdAt descending
  const q = query(entriesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as JournalEntry);
      });
      onData(list);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, collectionPath);
      } catch (wrappedErr: any) {
        onError(wrappedErr);
      }
    }
  );
}
