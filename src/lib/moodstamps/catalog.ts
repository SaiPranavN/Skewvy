import type { MoodStampReaction } from './types';

/**
 * Everything a MoodStamp says in words, per reaction.
 *
 * A Medal stamp and a Rotten Egg stamp share one layout but not one voice:
 * the line above the feeling, the name of the section, and the three
 * questions the sender answers all change with the reaction. Keeping them in
 * one table means the form, the preview, the saved record and the downloaded
 * image can never disagree about what a field is called.
 */

export interface ReasonPrompt {
  /** Printed on the stamp, beside the answer. */
  label: string;
  /** The question asked in the form. */
  question: string;
  placeholder: string;
}

export interface ReactionVoice {
  reaction: MoodStampReaction;
  /** "Medals", "Rotten Eggs". */
  plural: string;
  singular: string;
  /** What choosing it means, in the form. */
  meaning: string;
  /** The line printed above the feeling. */
  lead: string;
  /** The section heading on the stamp, and its aside. */
  intent: string;
  intentAside: string;
  /** Feelings offered as one-tap suggestions. */
  emotions: string[];
  reasons: [ReasonPrompt, ReasonPrompt, ReasonPrompt];
}

export const REACTION_VOICES: Record<MoodStampReaction, ReactionVoice> = {
  medal: {
    reaction: 'medal',
    plural: 'Medals',
    singular: 'Medal',
    meaning: 'Appreciation. For something that deserves to be noticed.',
    lead: 'You left me',
    intent: 'Personal appreciation',
    intentAside: 'Your effort was noticed.',
    emotions: ['Impressed', 'Grateful', 'Proud', 'Happy', 'Inspired', 'Supported', 'Relieved', 'Valued', 'Touched', 'Safe'],
    reasons: [
      {
        label: 'What you did',
        question: 'What did they do?',
        placeholder: 'You stayed late to help me finish the presentation.',
      },
      {
        label: 'Why it mattered',
        question: 'Why did it matter to you?',
        placeholder: 'I felt supported when I was under pressure.',
      },
      {
        label: 'What I want you to know',
        question: 'What do you want them to know?',
        placeholder: 'Your effort did not go unnoticed. Thank you.',
      },
    ],
  },
  rotten_egg: {
    reaction: 'rotten_egg',
    plural: 'Rotten Eggs',
    singular: 'Rotten Egg',
    meaning: 'Criticism. For something that needs to be said.',
    lead: 'This made me feel',
    intent: 'Constructive criticism',
    intentAside: 'Something needs attention.',
    emotions: ['Fed up', 'Frustrated', 'Disappointed', 'Let down', 'Hurt', 'Ignored', 'Angry', 'Annoyed', 'Overlooked', 'Stressed'],
    reasons: [
      {
        label: 'What happened',
        question: 'What happened?',
        placeholder: 'You changed the project deadline without informing the team.',
      },
      {
        label: 'How it affected me',
        question: 'How did it affect you?',
        placeholder: 'I had to cancel other plans and work late.',
      },
      {
        label: 'What I need next time',
        question: 'What do you need next time?',
        placeholder: 'Please communicate changes before they are finalized.',
      },
    ],
  },
};

export const EMOTION_MIN = 2;
export const EMOTION_MAX = 18;
export const QUANTITY_MIN = 1;
export const QUANTITY_MAX = 100;
export const QUANTITY_PRESETS = [1, 5, 10, 25, 50, 100] as const;
export const RECIPIENT_NAME_MAX = 30;

/**
 * Each answer is printed on the stamp, the third one large. The limits are
 * what still reads on a phone screen, not an arbitrary database width.
 */
export const REASON_LIMITS = [160, 160, 110] as const;
export const REASON_MIN = 3;

/** How strongly a count reads, in words, so the number is never the only cue. */
export function intensityLabel(quantity: number): string {
  if (quantity <= 1) return 'Just a touch';
  if (quantity <= 9) return 'Noticeably';
  if (quantity <= 24) return 'A lot';
  if (quantity <= 49) return 'Deeply';
  if (quantity <= 99) return 'Overwhelmingly';
  return 'As much as it gets';
}

/** Country codes offered for WhatsApp, most likely first. */
export const COUNTRY_CODES = [
  { code: '+91', label: 'India (+91)' },
  { code: '+1', label: 'US / Canada (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+971', label: 'UAE (+971)' },
  { code: '+65', label: 'Singapore (+65)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+49', label: 'Germany (+49)' },
  { code: '+33', label: 'France (+33)' },
  { code: '+82', label: 'South Korea (+82)' },
  { code: '+81', label: 'Japan (+81)' },
  { code: '+966', label: 'Saudi Arabia (+966)' },
  { code: '+974', label: 'Qatar (+974)' },
  { code: '+977', label: 'Nepal (+977)' },
  { code: '+94', label: 'Sri Lanka (+94)' },
  { code: '+880', label: 'Bangladesh (+880)' },
  { code: '+92', label: 'Pakistan (+92)' },
] as const;
