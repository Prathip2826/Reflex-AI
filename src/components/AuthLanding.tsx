import React, { useState } from 'react';
import { Sparkles, Shield, Lock, Brain, ArrowRight, CheckCircle2, UserCheck, AlertCircle } from 'lucide-react';

interface AuthLandingProps {
  onSignInWithGoogle: () => Promise<any>;
  onSignInGuest: () => Promise<any>;
}

export const AuthLanding: React.FC<AuthLandingProps> = ({
  onSignInWithGoogle,
  onSignInGuest,
}) => {
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingGuest, setLoadingGuest] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setLoadingGoogle(true);
      setErrorMessage(null);
      await onSignInWithGoogle();
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.message?.includes('auth/popup-closed-by-user') ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        // User closed the popup intentionally - no error message needed
        return;
      }
      setErrorMessage(err.message || 'Google Sign-In failed.');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleGuestLogin = async () => {
    try {
      setLoadingGuest(true);
      setErrorMessage(null);
      await onSignInGuest();
    } catch (err: any) {
      setErrorMessage(err.message || 'Guest login failed.');
    } finally {
      setLoadingGuest(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full text-center space-y-10">
        {/* Hero Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#f3efe6] border border-[#dcd3c5] text-[#935a34] text-xs sm:text-sm font-medium tracking-wide">
          <Sparkles className="w-4 h-4 text-[#c28e5e] animate-pulse" />
          <span>Introspective AI Journaling & Structured Reflection</span>
        </div>

        {/* Hero Title & Subtitle */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-6xl font-bold font-serif text-[#1a1a1a] tracking-tight leading-tight">
            Clear your thoughts.<br />
            <span className="text-[#c28e5e] font-serif italic">
              Converse with clarity.
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-[#5a524a] font-normal leading-relaxed">
            A private, thoughtful sanctuary for multi-turn reflections, cognitive reframing, and insightful dialogue with Gemini 3.6 Flash.
          </p>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="max-w-md mx-auto p-4 rounded-xl bg-[#fae8e8] border border-[#e8b5b5] text-[#9b3e3e] text-sm flex items-start justify-between gap-3 text-left">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#9b3e3e] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Authentication Notice</p>
                <p className="text-xs text-[#9b3e3e]/90 mt-0.5">{errorMessage}</p>
              </div>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs text-[#9b3e3e] hover:underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Authentication Card */}
        <div className="max-w-md mx-auto p-6 sm:p-8 bg-[#ffffff] rounded-2xl border border-[#e2dbce] shadow-sm space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-semibold text-[#1a1a1a] font-serif">Sign in to your Journal</h2>
            <p className="text-xs text-[#7c7369]">
              Your entries are protected by Cloud Firestore security rules.
            </p>
          </div>

          <div className="space-y-3">
            {/* Primary Google Login Button */}
            <button
              id="btn-google-signin"
              onClick={handleGoogleLogin}
              disabled={loadingGoogle || loadingGuest}
              className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-[#2d2d2d] hover:bg-[#1a1a1a] text-[#ffffff] font-semibold text-sm transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
            >
              {loadingGoogle ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                  <ArrowRight className="w-4 h-4 text-stone-300 group-hover:translate-x-0.5 transition-transform ml-auto" />
                </>
              )}
            </button>

            {/* Quick Guest Preview Button */}
            <button
              id="btn-guest-signin"
              onClick={handleGuestLogin}
              disabled={loadingGoogle || loadingGuest}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#f7f4ee] hover:bg-[#ece5d8] text-[#2d2d2d] font-medium text-xs border border-[#dcd3c5] transition-all disabled:opacity-50 cursor-pointer"
            >
              {loadingGuest ? (
                <div className="w-4 h-4 border-2 border-stone-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <UserCheck className="w-4 h-4 text-[#935a34]" />
                  <span>Try Anonymous Guest Session</span>
                </>
              )}
            </button>
          </div>

          <div className="pt-2 border-t border-[#e8e2d9] flex items-center justify-center gap-2 text-[11px] text-[#7c7369]">
            <Lock className="w-3.5 h-3.5 text-[#386145]" />
            <span>Zero password handling • Federated OAuth Only</span>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-4xl mx-auto pt-4">
          <div className="p-5 rounded-2xl bg-[#ffffff] border border-[#e8e2d9] shadow-xs space-y-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#f4eee5] border border-[#dcd3c5] flex items-center justify-center text-[#935a34]">
              <Brain className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold font-serif text-[#1a1a1a]">Multi-Turn Reflections</h3>
            <p className="text-xs text-[#6b635b] leading-relaxed">
              Converse with Gemini 3.6 Flash across multiple turns to unpack complex emotions, identify patterns, and find clarity.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#ffffff] border border-[#e8e2d9] shadow-xs space-y-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#eaf2ec] border border-[#c4dbcb] flex items-center justify-center text-[#2f5c3c]">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold font-serif text-[#1a1a1a]">Owner-Bound Firestore</h3>
            <p className="text-xs text-[#6b635b] leading-relaxed">
              Every journal entry is strictly scoped under your unique UID (<code className="text-[#2f5c3c] font-mono text-[10px]">users/{"{userId}"}</code>), preventing cross-user data leakage.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#ffffff] border border-[#e8e2d9] shadow-xs space-y-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#f3edf5] border border-[#d9cadc] flex items-center justify-center text-[#6e437c]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold font-serif text-[#1a1a1a]">Actionable Summaries</h3>
            <p className="text-xs text-[#6b635b] leading-relaxed">
              Instantly synthesize your entry into key insights, emotional takeaways, and practical micro-steps for personal growth.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
