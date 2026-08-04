'use client';

const PROMPTS = [
  'How many tenants do we have, broken down by status?',
  "What's our revenue so far this month?",
  'How many open support tickets are there?',
  'What are our top plans by active subscriptions?',
];

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
      <p className="text-sm text-muted-foreground">Ask about tenants, revenue, payments, or support tickets across the platform.</p>
      <div className="flex flex-wrap justify-center gap-2">
        {PROMPTS.map((prompt) => (
          <button key={prompt} onClick={() => onSelect(prompt)} className="rounded-full border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent">
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
