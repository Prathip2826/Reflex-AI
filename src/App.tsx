import { useState, useEffect } from 'react';
import { UserProfile, JournalEntry } from './types';
import {
  auth,
  subscribeToAuth,
  signInWithGoogle,
  signInGuest,
  signOutUser,
  subscribeUserEntries,
  deleteJournalEntry,
  testFirestoreConnection,
} from './lib/firebase';
import { Header } from './components/Header';
import { AuthLanding } from './components/AuthLanding';
import { JournalEditor } from './components/JournalEditor';
import { EntryHistory } from './components/EntryHistory';
import { InsightsStats } from './components/InsightsStats';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'editor' | 'history' | 'insights'>('editor');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Validate Firestore server connectivity on boot
  useEffect(() => {
    testFirestoreConnection().catch((err) => {
      console.warn('Firestore initial test connection note:', err);
    });
  }, []);

  // Subscribe to Firebase Auth State
  useEffect(() => {
    const unsubscribe = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to Realtime Firestore User Entries
  useEffect(() => {
    if (!user) {
      setEntries([]);
      setCurrentEntry(null);
      return;
    }

    setFirestoreError(null);
    const unsubscribe = subscribeUserEntries(
      user.uid,
      (userEntries) => {
        setEntries(userEntries);
      },
      (err) => {
        console.error('Firestore subscription error:', err);
        setFirestoreError(
          'Failed to synchronize entries with Cloud Firestore. Please verify permissions or network connectivity.'
        );
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleSignInGoogle = async () => {
    await signInWithGoogle();
  };

  const handleSignInGuest = async () => {
    await signInGuest();
  };

  const handleSignOut = async () => {
    await signOutUser();
    setUser(null);
    setCurrentEntry(null);
    setActiveTab('editor');
  };

  const handleSelectEntryForEditing = (entry: JournalEntry) => {
    setCurrentEntry(entry);
    setActiveTab('editor');
  };

  const handleNewSession = () => {
    setCurrentEntry(null);
    setActiveTab('editor');
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!user) return;
    await deleteJournalEntry(user.uid, entryId);
    if (currentEntry?.id === entryId) {
      setCurrentEntry(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#fcfaf7] text-[#1a1a1a] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-3 border-[#dcd3c5] border-t-[#c28e5e] rounded-full animate-spin" />
        <p className="text-sm font-medium text-[#5a524a] font-serif">
          Initializing ReflectAI workspace...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfaf7] text-[#1a1a1a] flex flex-col font-sans selection:bg-[#c28e5e]/20 selection:text-[#7a4e27]">
      {/* Top Application Navigation */}
      <Header
        user={user}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onSignOut={handleSignOut}
        entryCount={entries.length}
      />

      {/* Global Firestore Error Notice (if any) */}
      {firestoreError && (
        <div className="max-w-5xl mx-auto w-full px-4 pt-4">
          <div className="p-3.5 rounded-xl bg-[#fae8e8] border border-[#e8b5b5] text-[#9b3e3e] text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#9b3e3e] shrink-0" />
              <span>{firestoreError}</span>
            </div>
            <button
              onClick={() => setFirestoreError(null)}
              className="text-[11px] underline hover:text-[#7d2e2e]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {!user ? (
          <AuthLanding
            onSignInWithGoogle={handleSignInGoogle}
            onSignInGuest={handleSignInGuest}
          />
        ) : (
          <>
            {activeTab === 'editor' && (
              <JournalEditor
                user={user}
                currentEntry={currentEntry}
                onEntrySaved={(savedEntry) => {
                  setCurrentEntry(savedEntry);
                }}
                onNewSession={handleNewSession}
              />
            )}

            {activeTab === 'history' && (
              <EntryHistory
                entries={entries}
                onSelectEntry={handleSelectEntryForEditing}
                onDeleteEntry={handleDeleteEntry}
                onNewEntry={handleNewSession}
              />
            )}

            {activeTab === 'insights' && (
              <InsightsStats
                entries={entries}
                onStartReflection={handleNewSession}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e8e2d9] py-6 text-center text-xs text-[#7c7369] bg-[#fcfaf7]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ReflectAI • Introspective Journaling with Gemini 3.6 Flash</span>
          <span className="text-[11px] text-[#8c8278] font-mono">
            Firestore Database: {auth.currentUser ? 'Connected (Scoped)' : 'Awaiting Auth'}
          </span>
        </div>
      </footer>
    </div>
  );
}
