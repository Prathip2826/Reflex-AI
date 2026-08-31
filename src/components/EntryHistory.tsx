import React, { useState, useMemo } from 'react';
import { JournalEntry, MoodCategory } from '../types';
import { MOOD_TAGS } from '../data/presets';
import {
  Search,
  Calendar,
  MessageSquare,
  Trash2,
  ExternalLink,
  Download,
  Filter,
  Sparkles,
  BookOpen,
  ArrowUpDown,
  Check,
} from 'lucide-react';

interface EntryHistoryProps {
  entries: JournalEntry[];
  onSelectEntry: (entry: JournalEntry) => void;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onNewEntry: () => void;
}

export const EntryHistory: React.FC<EntryHistoryProps> = ({
  entries,
  onSelectEntry,
  onDeleteEntry,
  onNewEntry,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportedId, setExportedId] = useState<string | null>(null);

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    return entries
      .filter((entry) => {
        // Mood filter
        if (selectedMoodFilter !== 'all' && entry.mood !== selectedMoodFilter) {
          return false;
        }
        // Search query
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const titleMatch = entry.title?.toLowerCase().includes(q);
        const promptMatch = entry.initialPrompt?.toLowerCase().includes(q);
        const messagesMatch = entry.messages?.some((m) =>
          m.text?.toLowerCase().includes(q)
        );
        const summaryMatch = entry.summary?.toLowerCase().includes(q);
        return titleMatch || promptMatch || messagesMatch || summaryMatch;
      })
      .sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
  }, [entries, searchQuery, selectedMoodFilter, sortOrder]);

  // Handle Export Markdown
  const handleExportMarkdown = (entry: JournalEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    const markdown = `# ${entry.title || 'Journal Reflection'}
*Date: ${new Date(entry.createdAt).toLocaleString()}*
*Focus / Mood: ${entry.mood}*

---

## Conversation & Reflections
${entry.messages
  .map(
    (m) => `### ${m.role === 'user' ? '👤 User' : '✨ Gemini 3.6 Flash'} (${new Date(m.timestamp).toLocaleTimeString()})
${m.text}
`
  )
  .join('\n')}

${
  entry.summary
    ? `---
## Executive Summary
${entry.summary}
`
    : ''
}
`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(entry.title || 'reflection').toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);

    setExportedId(entry.id);
    setTimeout(() => setExportedId(null), 2000);
  };

  const handleDelete = async (entryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to permanently delete this reflection from Firestore?')) {
      try {
        setDeletingId(entryId);
        await onDeleteEntry(entryId);
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header with Search and Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-serif text-[#1a1a1a] flex items-center gap-2">
            <span>Reflection Archives</span>
            <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-[#f0eae0] text-[#5a524a] border border-[#e2dbce]">
              {entries.length} {entries.length === 1 ? 'Entry' : 'Entries'}
            </span>
          </h2>
          <p className="text-xs text-[#7c7369] mt-0.5">
            Isolated and permanently stored in your Firestore database.
          </p>
        </div>

        <button
          onClick={onNewEntry}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2d2d2d] hover:bg-[#1a1a1a] text-[#ffffff] font-semibold text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-[#c28e5e]" />
          <span>New Reflection</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 rounded-2xl bg-[#ffffff] border border-[#e2dbce] shadow-xs">
        {/* Search Field */}
        <div className="sm:col-span-6 relative">
          <Search className="w-4 h-4 text-[#8c8278] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="input-search-history"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keywords, insights, or titles..."
            className="w-full pl-10 pr-4 py-2 bg-[#fcfaf7] text-[#1a1a1a] placeholder-[#8c8278] rounded-xl border border-[#dcd3c5] focus:border-[#c28e5e] focus:outline-none text-xs sm:text-sm"
          />
        </div>

        {/* Mood Category Filter */}
        <div className="sm:col-span-4 flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#8c8278] shrink-0" />
          <select
            id="filter-mood"
            value={selectedMoodFilter}
            onChange={(e) => setSelectedMoodFilter(e.target.value)}
            className="w-full bg-[#fcfaf7] text-[#2d2d2d] text-xs px-3 py-2 rounded-xl border border-[#dcd3c5] focus:border-[#c28e5e] focus:outline-none cursor-pointer"
          >
            <option value="all">All Focus / Moods</option>
            {MOOD_TAGS.map((tag) => (
              <option key={tag.label} value={tag.label}>
                {tag.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Order Toggle */}
        <div className="sm:col-span-2 flex items-center">
          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#fcfaf7] hover:bg-[#f3efe6] text-[#2d2d2d] text-xs border border-[#dcd3c5] transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-[#935a34]" />
            <span>{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
          </button>
        </div>
      </div>

      {/* Entries List / Empty State */}
      {filteredEntries.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl bg-[#ffffff] border border-dashed border-[#dcd3c5] space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#f4eee5] border border-[#dcd3c5] flex items-center justify-center text-[#935a34]">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-serif font-semibold text-[#1a1a1a]">
              {searchQuery || selectedMoodFilter !== 'all'
                ? 'No matching entries found'
                : 'No reflection entries yet'}
            </h3>
            <p className="text-xs text-[#7c7369] max-w-sm mx-auto">
              {searchQuery || selectedMoodFilter !== 'all'
                ? 'Try adjusting your search terms or clearing the mood filter.'
                : 'Start your very first journaling reflection in the Studio to unpack ideas with Gemini.'}
            </p>
          </div>
          <button
            onClick={onNewEntry}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#f0ebe1] hover:bg-[#e6dfd5] text-[#2d2d2d] text-xs font-medium border border-[#dcd3c5] transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#935a34]" />
            <span>Start a Reflection</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEntries.map((entry) => {
            const firstAiReply = entry.messages.find((m) => m.role === 'assistant')?.text;
            const moodColorObj = MOOD_TAGS.find((m) => m.label === entry.mood);

            return (
              <div
                key={entry.id}
                onClick={() => onSelectEntry(entry)}
                className="p-5 rounded-2xl bg-[#ffffff] hover:bg-[#fcfaf7] border border-[#e6dfd5] hover:border-[#c28e5e]/50 transition-all cursor-pointer flex flex-col justify-between space-y-4 group shadow-2xs hover:shadow-xs"
              >
                <div className="space-y-2.5">
                  {/* Card Header: Mood Tag & Date */}
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                        moodColorObj ? moodColorObj.color : 'bg-[#f0eae0] text-[#4a423a] border-[#dcd3c5]'
                      }`}
                    >
                      {entry.mood}
                    </span>

                    <div className="flex items-center gap-1 text-[11px] text-[#7c7369]">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-serif font-semibold text-[#1a1a1a] group-hover:text-[#935a34] transition-colors line-clamp-1">
                    {entry.title || 'Untitled Reflection'}
                  </h3>

                  {/* Snippet */}
                  <p className="text-xs text-[#5a524a] line-clamp-2 leading-relaxed font-sans">
                    {entry.initialPrompt || entry.messages[0]?.text || 'No preview text'}
                  </p>

                  {/* Gemini Response Highlight */}
                  {firstAiReply && (
                    <div className="p-2.5 rounded-xl bg-[#f8f5ee] border border-[#e8e0d5] text-[11px] text-[#6b635b] line-clamp-2 italic font-serif">
                      <span className="text-[#935a34] font-medium not-italic font-sans">Gemini: </span>
                      {firstAiReply}
                    </div>
                  )}
                </div>

                {/* Card Footer: Turn count & Action Buttons */}
                <div className="pt-3 border-t border-[#ece5da] flex items-center justify-between text-xs text-[#7c7369]">
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <MessageSquare className="w-3.5 h-3.5 text-[#8c8278]" />
                    <span>{entry.messages.length} turns</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleExportMarkdown(entry, e)}
                      title="Export as Markdown"
                      className="p-1.5 rounded-lg hover:bg-[#f0eae0] hover:text-[#1a1a1a] text-[#7c7369] transition-colors cursor-pointer"
                    >
                      {exportedId === entry.id ? (
                        <Check className="w-3.5 h-3.5 text-[#386145]" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={(e) => handleDelete(entry.id, e)}
                      disabled={deletingId === entry.id}
                      title="Delete from Firestore"
                      className="p-1.5 rounded-lg hover:bg-[#fae8e8] hover:text-[#9b3e3e] text-[#7c7369] transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <span className="text-[11px] text-[#935a34] font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 ml-1">
                      Open <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
