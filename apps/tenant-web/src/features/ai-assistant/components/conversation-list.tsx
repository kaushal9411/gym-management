'use client';

import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAiConversations, useDeleteAiConversation } from '../hooks/use-ai-assistant';

interface ConversationListProps {
  activeConversationId: string | null;
  onSelect: (conversationId: string) => void;
  onNew: () => void;
}

export function ConversationList({ activeConversationId, onSelect, onNew }: ConversationListProps) {
  const { data, isLoading } = useAiConversations({ page: 1, limit: 50 });
  const deleteConversation = useDeleteAiConversation();

  return (
    <div className="flex h-full flex-col">
      <Button size="sm" className="mb-3 justify-start gap-2" onClick={onNew}>
        <Plus className="size-4" /> New chat
      </Button>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      ) : data && data.items.length > 0 ? (
        <div className="flex-1 space-y-1 overflow-y-auto">
          {data.items.map((conversation) => (
            <div
              key={conversation.id}
              className={cn(
                'group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors',
                conversation.id === activeConversationId ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
              )}
            >
              <button onClick={() => onSelect(conversation.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <MessageSquare className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{conversation.title}</span>
              </button>
              <button
                onClick={() =>
                  deleteConversation.mutate(conversation.id, {
                    onSuccess: () => toast.success('Conversation deleted.'),
                    onError: () => toast.error('Could not delete this conversation.'),
                  })
                }
                className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                aria-label="Delete conversation"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="flex-1 pt-4 text-center text-sm text-muted-foreground">No conversations yet.</p>
      )}
    </div>
  );
}
