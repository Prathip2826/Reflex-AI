import { ReflectionPromptPreset } from '../types';

export const REFLECTION_PRESETS: ReflectionPromptPreset[] = [
  {
    id: 'gratitude-spark',
    title: 'Gratitude & Joy',
    category: 'Gratitude',
    suggestedMode: 'mindfulness',
    iconName: 'Sparkles',
    promptText: 'What are three unexpected things that brought warmth, relief, or gratitude to your day, and why did they matter to you?',
  },
  {
    id: 'decision-clarity',
    title: 'Decision Crossroads',
    category: 'Clarity & Focus',
    suggestedMode: 'reflect',
    iconName: 'Compass',
    promptText: 'What decision is currently occupying your mind? What feels clear, what feels uncertain, and what is the underlying value guiding you?',
  },
  {
    id: 'challenge-reframing',
    title: 'Overcoming Obstacles',
    category: 'Overcoming Challenge',
    suggestedMode: 'reflect',
    iconName: 'Flame',
    promptText: 'What recent frustration or roadblock did you encounter? What did it teach you about your boundaries, resilience, or next steps?',
  },
  {
    id: 'creative-brainstorm',
    title: 'Brainstorm & Vision',
    category: 'Goal Setting',
    suggestedMode: 'brainstorm',
    iconName: 'Lightbulb',
    promptText: 'If you had zero fear of judgment or failure for one project or ambition this month, what bold step would you take first?',
  },
  {
    id: 'evening-unwind',
    title: 'Evening Synthesis',
    category: 'Thoughtful',
    suggestedMode: 'summary',
    iconName: 'Moon',
    promptText: 'Looking back across today: Where did your energy flow naturally, what drained you, and how can you let go of today to rest peacefully?',
  },
];

export const MOOD_TAGS = [
  { label: 'Thoughtful', icon: 'Brain', color: 'bg-[#c28e5e]/10 text-[#935a34] border-[#c28e5e]/30' },
  { label: 'Gratitude', icon: 'Heart', color: 'bg-[#b85d5d]/10 text-[#9b3e3e] border-[#b85d5d]/30' },
  { label: 'Goal Setting', icon: 'Target', color: 'bg-[#4a7c59]/10 text-[#2f5c3c] border-[#4a7c59]/30' },
  { label: 'Clarity & Focus', icon: 'Zap', color: 'bg-[#4a6b82]/10 text-[#315269] border-[#4a6b82]/30' },
  { label: 'Mindfulness', icon: 'Sun', color: 'bg-[#7c6a59]/10 text-[#5a4a3c] border-[#7c6a59]/30' },
  { label: 'Overcoming Challenge', icon: 'Shield', color: 'bg-[#b07038]/10 text-[#8c5222] border-[#b07038]/30' },
] as const;
