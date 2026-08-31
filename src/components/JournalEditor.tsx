import React, { useState, useEffect, useRef } from 'react';
import {
  JournalEntry,
  ChatTurn,
  MoodCategory,
  ReflectionMode,
  UserProfile,
} from '../types';
import { REFLECTION_PRESETS, MOOD_TAGS } from '../data/presets';
import { requestGeminiReflection, requestGeminiSummary } from '../lib/geminiClient';
import { saveJournalEntry } from '../lib/firebase';
import {
  Send,
  Sparkles,
  Save,
  Check,
  RefreshCw,
  Copy,
  Lightbulb,
  FileText,
  Heart,
  PlusCircle,
  AlertTriangle,
  Bot,
  User as UserIcon,
  Layers,
  ChevronDown,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface JournalEditorProps {
  user: UserProfile;
  currentEntry: JournalEntry | null;
  onEntrySaved: (entry: JournalEntry) => void;
  onNewSession: () => void;
}

export const JournalEditor: React.FC<JournalEditorProps> = ({
  user,
  currentEntry,
  onEntrySaved,
  onNewSession,
}) => {
  // Entry State
  const [entryId, setEntryId] = useState<string>(
    currentEntry ? currentEntry.id : `entry_${Date.now()}`
  );
  const [title, setTitle] = useState<string>(currentEntry?.title || '');
  const [mood, setMood] = useState<MoodCategory>(currentEntry?.mood || 'Thoughtful');
  const [selectedMode, setSelectedMode] = useState<ReflectionMode>('reflect');
  const [messages, setMessages] = useState<ChatTurn[]>(currentEntry?.messages || []);
  const [summary, setSummary] = useState<string>(currentEntry?.summary || '');

  // Input State
  const [inputText, setInputText] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState<boolean>(!currentEntry && messages.length === 0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state when currentEntry prop changes
  useEffect(() => {
    if (currentEntry) {
      setEntryId(currentEntry.id);
      setTitle(currentEntry.title || '');
      setMood(currentEntry.mood || 'Thoughtful');
      setMessages(currentEntry.messages || []);
      setSummary(currentEntry.summary || '');
      setShowPresets(false);
      setSaveStatus('saved');
    } else {
      // New blank entry
      setEntryId(`entry_${Date.now()}`);
      setTitle('');
      setMood('Thoughtful');
      setMessages([]);
      setSummary('');
      setInputText('');
      setShowPresets(true);
      setSaveStatus('idle');
    }
  }, [currentEntry]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Calculate stats
  const totalWords = messages.reduce((acc, m) => acc + (m.text ? m.text.trim().split(/\s+/).length : 0), 0);
  const characterCount = inputText.length;

  // Persist entry to Firestore
  const persistEntry = async (
    updatedMessages: ChatTurn[],
    customTitle?: string,
    customSummary?: string
  ) => {
    const finalTitle = customTitle !== undefined ? customTitle : title || 'Untitled Reflection';
    const finalSummary = customSummary !== undefined ? customSummary : summary;
    const initialPrompt = updatedMessages.length > 0 ? updatedMessages[0].text : '';

    const entryToSave: JournalEntry = {
      id: entryId,
      userId: user.uid,
      title: finalTitle,
      initialPrompt,
      mood,
      messages: updatedMessages,
      summary: finalSummary,
      createdAt: currentEntry?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      wordCount: totalWords,
    };

    try {
      setIsSaving(true);
      setSaveStatus('saving');
      setErrorMessage(null);
      await saveJournalEntry(user.uid, entryToSave);
      setSaveStatus('saved');
      onEntrySaved(entryToSave);
    } catch (err: any) {
      console.error('Save failed:', err);
      setSaveStatus('error');
      setErrorMessage('Failed to sync entry to Firestore. Please click Retry.');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit a turn (User prompt + Gemini response)
  const handleSubmitTurn = async (e?: React.FormEvent, overrideText?: string, overrideMode?: ReflectionMode) => {
    if (e) e.preventDefault();
    const textToSend = (overrideText || inputText).trim();
    if (!textToSend || isGenerating) return;

    const activeMode = overrideMode || selectedMode;
    const userTurn: ChatTurn = {
      id: `turn_${Date.now()}_user`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toISOString(),
      mode: activeMode,
    };

    const newMessagesList = [...messages, userTurn];
    setMessages(newMessagesList);
    setInputText('');
    setShowPresets(false);
    setIsGenerating(true);
    setErrorMessage(null);

    // Auto-generate a title from first prompt if empty
    let autoTitle = title;
    if (!title && messages.length === 0) {
      autoTitle = textToSend.slice(0, 45).replace(/[\r\n]+/g, ' ') + (textToSend.length > 45 ? '...' : '');
      setTitle(autoTitle);
    }

    try {
      // Call server endpoint with conversation history
      const result = await requestGeminiReflection({
        messages: newMessagesList.map((m) => ({ role: m.role, text: m.text })),
        mode: activeMode,
        title: autoTitle,
        mood,
      });

      const assistantTurn: ChatTurn = {
        id: `turn_${Date.now()}_ai`,
        role: 'assistant',
        text: result.reply,
        timestamp: result.timestamp || new Date().toISOString(),
        mode: activeMode,
        modelUsed: result.modelUsed,
      };

      const finalMessages = [...newMessagesList, assistantTurn];
      setMessages(finalMessages);

      // Persist complete conversation to Firestore immediately
      await persistEntry(finalMessages, autoTitle);
    } catch (err: any) {
      console.error('Generation error:', err);
      setErrorMessage(err.message || 'Failed to receive reflection from Gemini.');
      // Still persist user turn so thoughts are never lost
      await persistEntry(newMessagesList, autoTitle);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate Summary & Key Takeaways
  const handleGenerateSummary = async () => {
    if (messages.length === 0 || isGenerating) return;
    setIsGenerating(true);
    setErrorMessage(null);

    const fullContent = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
      .join('\n\n');

    try {
      const result = await requestGeminiSummary(fullContent, title);
      setSummary(result.summary);
      await persistEntry(messages, title, result.summary);
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.85 } });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to synthesize summary.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Preset Selection
  const handleSelectPreset = (preset: typeof REFLECTION_PRESETS[0]) => {
    setTitle(preset.title);
    setMood(preset.category);
    setSelectedMode(preset.suggestedMode);
    setInputText(preset.promptText);
    setShowPresets(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Copy text to clipboard
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#ffffff] border border-[#e2dbce] shadow-xs">
        <div className="flex-1">
          <input
            id="input-entry-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => persistEntry(messages, title)}
            placeholder="Name this reflection (e.g. Navigating Career Transition)..."
            className="w-full bg-transparent text-lg sm:text-xl font-serif font-semibold text-[#1a1a1a] placeholder-[#8c8278] focus:outline-none focus:ring-0 border-b border-transparent focus:border-[#c28e5e] pb-1"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mood Selector */}
          <div className="relative">
            <select
              id="select-mood"
              value={mood}
              onChange={(e) => {
                const nextMood = e.target.value as MoodCategory;
                setMood(nextMood);
                persistEntry(messages, title);
              }}
              className="bg-[#f7f4ee] text-[#2d2d2d] text-xs font-medium px-3 py-1.5 rounded-lg border border-[#dcd3c5] hover:border-[#c28e5e]/60 focus:outline-none focus:ring-1 focus:ring-[#c28e5e] cursor-pointer"
            >
              {MOOD_TAGS.map((tag) => (
                <option key={tag.label} value={tag.label}>
                  {tag.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sync Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f7f4ee] border border-[#e2dbce] text-xs">
            {saveStatus === 'saving' && (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-[#c28e5e] animate-spin" />
                <span className="text-[#6b635b]">Saving...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <Check className="w-3.5 h-3.5 text-[#386145]" />
                <span className="text-[#2f5c3c] font-mono text-[11px]">Synced to Cloud</span>
              </>
            )}
            {saveStatus === 'error' && (
              <button
                onClick={() => persistEntry(messages, title)}
                className="flex items-center gap-1 text-[#9b3e3e] hover:text-[#7d2e2e] font-medium cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-[#9b3e3e]" />
                <span>Retry Save</span>
              </button>
            )}
            {saveStatus === 'idle' && (
              <span className="text-[#7c7369] text-[11px]">Draft</span>
            )}
          </div>

          {/* New Session Button */}
          <button
            id="btn-new-session"
            onClick={onNewSession}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f0ebe1] hover:bg-[#e6dfd5] text-[#2d2d2d] text-xs font-medium border border-[#dcd3c5] transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5 text-[#935a34]" />
            <span>New Entry</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-[#fae8e8] border border-[#e8b5b5] text-[#9b3e3e] text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#9b3e3e] shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs text-[#9b3e3e] hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Preset Prompts Drawer / Section */}
      {showPresets && messages.length === 0 && (
        <div className="p-6 rounded-2xl bg-[#ffffff] border border-[#e2dbce] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#c28e5e]" />
              <h3 className="text-sm font-semibold font-serif text-[#1a1a1a] tracking-wide">
                Inspirational Reflection Prompts
              </h3>
            </div>
            <button
              onClick={() => setShowPresets(false)}
              className="text-xs text-[#7c7369] hover:text-[#1a1a1a] cursor-pointer"
            >
              Skip to freeform
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {REFLECTION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className="p-4 rounded-xl bg-[#fcfaf7] hover:bg-[#f5efe6] border border-[#e6dfd5] hover:border-[#c28e5e]/50 text-left transition-all group space-y-2 flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold font-serif text-[#1a1a1a] group-hover:text-[#935a34] transition-colors">
                      {preset.title}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f0eae0] text-[#5a524a]">
                      {preset.category}
                    </span>
                  </div>
                  <p className="text-xs text-[#6b635b] line-clamp-3 leading-relaxed">
                    {preset.promptText}
                  </p>
                </div>
                <span className="text-[11px] text-[#935a34] font-medium pt-1">
                  Use this prompt →
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reflection Conversation Feed */}
      <div className="space-y-6">
        {messages.map((turn, index) => {
          const isUser = turn.role === 'user';
          return (
            <div
              key={turn.id}
              className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-[#f4eee5] border border-[#dcd3c5] flex items-center justify-center text-[#935a34] shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-3xl rounded-2xl p-5 space-y-3 ${
                  isUser
                    ? 'bg-[#f4eee4] border border-[#dfd2be] text-[#1a1a1a] ml-12 shadow-2xs'
                    : 'bg-[#ffffff] border border-[#e6dfd5] text-[#2d2d2d] mr-12 shadow-xs'
                }`}
              >
                {/* Header of message turn */}
                <div className="flex items-center justify-between gap-4 text-[11px] text-[#7c7369] border-b border-[#ece5da] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#1a1a1a] font-serif">
                      {isUser ? 'You' : 'Gemini 3.6 Flash'}
                    </span>
                    {turn.mode && (
                      <span className="px-1.5 py-0.5 rounded bg-[#f0eae0] text-[10px] text-[#5a524a] capitalize">
                        {turn.mode}
                      </span>
                    )}
                    {turn.modelUsed && (
                      <span className="font-mono text-[10px] text-[#935a34]">
                        {turn.modelUsed}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span>
                      {new Date(turn.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <button
                      onClick={() => handleCopy(turn.text, turn.id)}
                      className="p-1 hover:text-[#1a1a1a] transition-colors cursor-pointer"
                      title="Copy content"
                    >
                      {copiedId === turn.id ? (
                        <Check className="w-3.5 h-3.5 text-[#386145]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Message Body */}
                <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-sans text-[#2d2d2d]">
                  {turn.text}
                </div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-[#e8e2d7] border border-[#d5cbbe] flex items-center justify-center text-[#4a423a] shrink-0 mt-1">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Typing / Generating Indicator */}
        {isGenerating && (
          <div className="flex gap-4 justify-start items-center">
            <div className="w-8 h-8 rounded-xl bg-[#f4eee5] border border-[#dcd3c5] flex items-center justify-center text-[#935a34] shrink-0">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="p-4 rounded-2xl bg-[#ffffff] border border-[#e6dfd5] text-[#5a524a] text-sm flex items-center gap-3 shadow-xs">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-[#c28e5e] animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-[#c28e5e] animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-[#c28e5e] animate-bounce [animation-delay:0.4s]" />
              </div>
              <span className="font-serif italic">Gemini is reflecting on your thoughts...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Generated Summary Card (if available) */}
      {summary && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#f8f5ee] to-[#f3efe6] border border-[#d9ccba] space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#935a34]">
              <FileText className="w-5 h-5" />
              <h3 className="text-base font-semibold font-serif text-[#1a1a1a]">Executive Reflection Summary</h3>
            </div>
            <button
              onClick={() => handleCopy(summary, 'summary')}
              className="flex items-center gap-1 text-xs text-[#7c7369] hover:text-[#1a1a1a] cursor-pointer"
            >
              {copiedId === 'summary' ? (
                <Check className="w-3.5 h-3.5 text-[#386145]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Copy</span>
            </button>
          </div>
          <div className="text-sm text-[#2d2d2d] whitespace-pre-wrap leading-relaxed border-t border-[#dfd4c5] pt-3 font-sans">
            {summary}
          </div>
        </div>
      )}

      {/* Input Area and AI Mode Toolbar */}
      <div className="sticky bottom-4 z-30 p-4 rounded-2xl bg-[#ffffff]/95 border border-[#e2dbce] shadow-md backdrop-blur-md space-y-3">
        {/* Reflection Mode Badges */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-[#6b635b]">
            <Layers className="w-3.5 h-3.5 text-[#935a34]" />
            <span className="hidden sm:inline font-medium">AI Interaction Lens:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              id="mode-reflect"
              onClick={() => setSelectedMode('reflect')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                selectedMode === 'reflect'
                  ? 'bg-[#f4eee5] text-[#935a34] border border-[#c28e5e]/50 font-semibold shadow-2xs'
                  : 'bg-[#f7f4ee] text-[#6b635b] hover:text-[#1a1a1a] border border-[#e6dfd5]'
              }`}
            >
              🔍 Reflect & Inquire
            </button>

            <button
              type="button"
              id="mode-brainstorm"
              onClick={() => setSelectedMode('brainstorm')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                selectedMode === 'brainstorm'
                  ? 'bg-[#f4eee5] text-[#935a34] border border-[#c28e5e]/50 font-semibold shadow-2xs'
                  : 'bg-[#f7f4ee] text-[#6b635b] hover:text-[#1a1a1a] border border-[#e6dfd5]'
              }`}
            >
              💡 Brainstorm Next Steps
            </button>

            <button
              type="button"
              id="mode-mindfulness"
              onClick={() => setSelectedMode('mindfulness')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                selectedMode === 'mindfulness'
                  ? 'bg-[#f4eee5] text-[#935a34] border border-[#c28e5e]/50 font-semibold shadow-2xs'
                  : 'bg-[#f7f4ee] text-[#6b635b] hover:text-[#1a1a1a] border border-[#e6dfd5]'
              }`}
            >
              🌿 Mindfulness & Reframing
            </button>

            {messages.length > 0 && (
              <button
                type="button"
                id="btn-summarize-entry"
                onClick={handleGenerateSummary}
                disabled={isGenerating}
                className="px-2.5 py-1 rounded-lg bg-[#eaf2ec] hover:bg-[#dbebd9] text-[#2f5c3c] border border-[#b8d9c2] text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Synthesize Summary</span>
              </button>
            )}
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmitTurn} className="space-y-2">
          <div className="relative">
            <textarea
              id="input-journal-text"
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmitTurn();
                }
              }}
              rows={messages.length === 0 ? 4 : 3}
              placeholder={
                messages.length === 0
                  ? "Write down your journal entry, thought, or reflection freely... (Press Ctrl+Enter to send to Gemini)"
                  : "Reply to Gemini's reflection, ask follow-up questions, or delve deeper..."
              }
              className="w-full p-4 rounded-xl bg-[#fcfaf7] text-[#1a1a1a] placeholder-[#8c8278] border border-[#dcd3c5] focus:border-[#c28e5e] focus:outline-none text-sm sm:text-base resize-y transition-all"
            />

            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <span className="text-[11px] text-[#7c7369] font-mono hidden sm:inline">
                {characterCount} chars
              </span>

              <button
                type="submit"
                id="btn-submit-turn"
                disabled={!inputText.trim() || isGenerating}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2d2d2d] hover:bg-[#1a1a1a] text-[#ffffff] font-semibold text-xs sm:text-sm transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{messages.length === 0 ? 'Reflect with AI' : 'Send Turn'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#7c7369] px-1">
            <span>
              {messages.length > 0
                ? `${messages.length} conversation turns • ${totalWords} words`
                : 'Freeform or prompt-assisted journal entry'}
            </span>
            <span className="hidden sm:inline">Press ⌘+Enter to submit</span>
          </div>
        </form>
      </div>
    </div>
  );
};
