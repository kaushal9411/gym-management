'use client';

const PROMPTS = [
  'How many active members do we have right now?',
  'Which memberships are expiring in the next 7 days?',
  "What's our revenue so far this month?",
  'How many check-ins have we had today?',
];

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
      <p className="text-sm text-muted-foreground">Ask about your members, staff, attendance, finances, or ask me to create a member, renew a membership, or send a notification.</p>
      <div className="flex flex-wrap justify-center gap-2">
        {PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onSelect(prompt)}
            className="rounded-full border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
