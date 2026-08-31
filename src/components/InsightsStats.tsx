import React from 'react';
import { JournalEntry } from '../types';
import { MOOD_TAGS } from '../data/presets';
import {
  Brain,
  MessageSquare,
  Sparkles,
  Award,
  Calendar,
  Zap,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';

interface InsightsStatsProps {
  entries: JournalEntry[];
  onStartReflection: () => void;
}

export const InsightsStats: React.FC<InsightsStatsProps> = ({
  entries,
  onStartReflection,
}) => {
  const totalEntries = entries.length;
  const totalTurns = entries.reduce((acc, e) => acc + (e.messages ? e.messages.length : 0), 0);
  const totalWords = entries.reduce(
    (acc, e) =>
      acc +
      e.messages.reduce(
        (mAcc, m) => mAcc + (m.text ? m.text.trim().split(/\s+/).length : 0),
        0
      ),
    0
  );

  // Mood counts
  const moodCounts: Record<string, number> = {};
  entries.forEach((e) => {
    moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h2 className="text-2xl font-bold font-serif text-[#1a1a1a] flex items-center gap-2">
          <span>Cognitive Reflections & Insights</span>
        </h2>
        <p className="text-xs text-[#7c7369] mt-0.5">
          A high-level view of your journaling rhythm, themes, and AI dialogues.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#ffffff] border border-[#e2dbce] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-[#7c7369]">
            <span>Total Entries</span>
            <div className="p-1.5 rounded-lg bg-[#f4eee5] text-[#935a34]">
              <Brain className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-serif text-[#1a1a1a]">
            {totalEntries}
          </p>
          <p className="text-[11px] text-[#7c7369]">Archived in Firestore</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#ffffff] border border-[#e2dbce] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-[#7c7369]">
            <span>Dialogue Turns</span>
            <div className="p-1.5 rounded-lg bg-[#eaf2ec] text-[#2f5c3c]">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-serif text-[#1a1a1a]">
            {totalTurns}
          </p>
          <p className="text-[11px] text-[#7c7369]">With Gemini 3.6 Flash</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#ffffff] border border-[#e2dbce] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-[#7c7369]">
            <span>Words Reflected</span>
            <div className="p-1.5 rounded-lg bg-[#eaf1f7] text-[#315269]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-serif text-[#1a1a1a]">
            {totalWords.toLocaleString()}
          </p>
          <p className="text-[11px] text-[#7c7369]">Written & Synthesized</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#ffffff] border border-[#e2dbce] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-[#7c7369]">
            <span>Data Security</span>
            <div className="p-1.5 rounded-lg bg-[#f3edf5] text-[#6e437c]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-serif text-[#1a1a1a]">
            100%
          </p>
          <p className="text-[11px] text-[#2f5c3c]">Owner-Bound Rules Active</p>
        </div>
      </div>

      {/* Mood Distribution */}
      <div className="p-6 rounded-2xl bg-[#ffffff] border border-[#e2dbce] shadow-xs space-y-4">
        <h3 className="text-base font-semibold font-serif text-[#1a1a1a]">
          Themes & Emotional Focus Distribution
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {MOOD_TAGS.map((tag) => {
            const count = moodCounts[tag.label] || 0;
            const percentage = totalEntries > 0 ? Math.round((count / totalEntries) * 100) : 0;
            return (
              <div
                key={tag.label}
                className="p-3.5 rounded-xl bg-[#fcfaf7] border border-[#e6dfd5] space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#2d2d2d] truncate">{tag.label}</span>
                  <span className="text-xs font-mono text-[#935a34] font-semibold">{count}</span>
                </div>
                <div className="w-full bg-[#ede6da] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#c28e5e] h-full rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-[10px] text-[#7c7369]">{percentage}% of entries</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reflection Mindfulness Tip */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#f8f5ee] to-[#f3efe6] border border-[#dcd3c5] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#935a34] text-sm font-semibold font-serif">
            <Sparkles className="w-4 h-4 text-[#c28e5e]" />
            <span>Reflective Habit Recommendation</span>
          </div>
          <p className="text-xs text-[#5a524a] leading-relaxed max-w-xl font-sans">
            Multi-turn dialoguing with Gemini helps unlock implicit assumptions. Try using the "Mindfulness & Reframing" mode to discover fresh perspectives on challenging situations.
          </p>
        </div>

        <button
          onClick={onStartReflection}
          className="shrink-0 px-4 py-2 rounded-xl bg-[#2d2d2d] hover:bg-[#1a1a1a] text-[#ffffff] font-semibold text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
        >
          Open Studio
        </button>
      </div>
    </div>
  );
};
