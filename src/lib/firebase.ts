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
  getDocs,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import type { JournalEntry, UserProfile } from '../types';
import firebaseConfigData from '../../firebase-applet-config.json';

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
export async function signInWithGoogle(): Promise<UserProfile> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const profile = mapFirebaseUser(result.user);
    if (!profile) throw new Error('User profile could not be loaded.');
    return profile;
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    // If popup blocked or failed in sandbox iframe, give descriptive message
    throw new Error(
      error?.code === 'auth/popup-blocked'
        ? 'Sign-in popup was blocked by browser. Please allow popups or open in a new tab.'
        : error?.message || 'Failed to sign in with Google.'
    );
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
  const entryDocRef = doc(db, 'users', userId, 'entries', entry.id);
  await setDoc(entryDocRef, cleanData, { merge: true });

  // Also log interaction in interactions subcollection for audit / tracking
  try {
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
  const entryDocRef = doc(db, 'users', userId, 'entries', entryId);
  await deleteDoc(entryDocRef);
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
      console.error('Error subscribing to user entries:', err);
      onError(err);
    }
  );
}
