export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous?: boolean;
}

export type ReflectionMode = 'reflect' | 'summary' | 'brainstorm' | 'mindfulness';

export type MoodCategory =
  | 'Thoughtful'
  | 'Gratitude'
  | 'Goal Setting'
  | 'Clarity & Focus'
  | 'Mindfulness'
  | 'Overcoming Challenge';

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string; // ISO string
  mode?: ReflectionMode;
  modelUsed?: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  initialPrompt: string;
  mood: MoodCategory;
  messages: ChatTurn[];
  summary?: string;
  tags?: string[];
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  wordCount?: number;
}

export interface ReflectionPromptPreset {
  id: string;
  title: string;
  category: MoodCategory;
  promptText: string;
  suggestedMode: ReflectionMode;
  iconName: string;
}
