import React from 'react';
import { UserProfile } from '../types';
import { Sparkles, BookOpen, History, BarChart3, LogOut, ShieldCheck, Database } from 'lucide-react';

interface HeaderProps {
  user: UserProfile | null;
  activeTab: 'editor' | 'history' | 'insights';
  onSelectTab: (tab: 'editor' | 'history' | 'insights') => void;
  onSignOut: () => void;
  entryCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTab,
  onSelectTab,
  onSignOut,
  entryCount,
}) => {
  return (
    <header className="border-b border-[#e8e2d9] bg-[#fcfaf7]/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#f4eee5] border border-[#dcd3c5] flex items-center justify-center text-[#935a34] shadow-xs">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold font-serif tracking-tight text-[#1a1a1a]">
                  Reflect<span className="text-[#c28e5e] font-serif italic">AI</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#f3efe6] text-[#5a524a] border border-[#e6dfd5]">
                  <Database className="w-3 h-3 text-[#386145]" />
                  Firestore Isolated
                </span>
              </div>
              <p className="text-xs text-[#7c7369] hidden md:block">
                Powered by Gemini 3.6 Flash & Cloud Firestore
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          {user && (
            <nav className="flex items-center p-1 bg-[#f0eae0] rounded-xl border border-[#e2dbce]">
              <button
                id="nav-editor-tab"
                onClick={() => onSelectTab('editor')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  activeTab === 'editor'
                    ? 'bg-[#ffffff] text-[#1a1a1a] border border-[#dcd3c5] shadow-xs font-semibold'
                    : 'text-[#6b635b] hover:text-[#1a1a1a]'
                }`}
              >
                <BookOpen className="w-4 h-4 text-[#935a34]" />
                <span>Studio</span>
              </button>

              <button
                id="nav-history-tab"
                onClick={() => onSelectTab('history')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  activeTab === 'history'
                    ? 'bg-[#ffffff] text-[#1a1a1a] border border-[#dcd3c5] shadow-xs font-semibold'
                    : 'text-[#6b635b] hover:text-[#1a1a1a]'
                }`}
              >
                <History className="w-4 h-4 text-[#935a34]" />
                <span>History</span>
                {entryCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 text-[10px] rounded-full bg-[#e8e2d7] text-[#4a423a] font-mono">
                    {entryCount}
                  </span>
                )}
              </button>

              <button
                id="nav-insights-tab"
                onClick={() => onSelectTab('insights')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  activeTab === 'insights'
                    ? 'bg-[#ffffff] text-[#1a1a1a] border border-[#dcd3c5] shadow-xs font-semibold'
                    : 'text-[#6b635b] hover:text-[#1a1a1a]'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-[#935a34]" />
                <span>Insights</span>
              </button>
            </nav>
          )}

          {/* User Profile & Logout */}
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full border border-[#dcd3c5] object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#f3efe6] text-[#935a34] border border-[#dcd3c5] flex items-center justify-center text-xs font-semibold font-serif">
                    {(user.displayName || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-medium text-[#1a1a1a] max-w-[130px] truncate">
                    {user.displayName || 'User'}
                  </p>
                  <p className="text-[10px] text-[#7c7369] max-w-[130px] truncate font-mono">
                    {user.email || (user.isAnonymous ? 'Guest User' : 'Authenticated')}
                  </p>
                </div>
              </div>

              <button
                id="btn-signout"
                onClick={onSignOut}
                title="Sign Out"
                className="p-2 rounded-lg bg-[#ffffff] hover:bg-[#fae8e8] hover:text-[#a04646] text-[#6b635b] border border-[#dcd3c5] transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-[#6b635b]">
              <ShieldCheck className="w-4 h-4 text-[#386145]" />
              <span>Secure Auth Required</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
