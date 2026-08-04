'use client';

import * as React from 'react';
import { RotateCcw, Send, Square, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActionConfirmationCard } from './action-confirmation-card';
import { MessageBubble } from './message-bubble';
import { SuggestedPrompts } from './suggested-prompts';
import { useAiChatStream, useAiConversation, useClearAiConversation } from '../hooks/use-ai-assistant';
import type { AiMessage } from '../types';

interface ChatWindowProps {
  conversationId: string;
}

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const { data: conversation, isLoading } = useAiConversation(conversationId);
  const { pendingMessages, streamingText, isStreaming, send, regenerate, stop } = useAiChatStream(conversationId);
  const clearConversation = useClearAiConversation();
  const [draft, setDraft] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const persistedMessages = conversation?.messages ?? [];
  const lastMessage = persistedMessages[persistedMessages.length - 1];
  const canRegenerate = !isStreaming && lastMessage?.role === 'ASSISTANT' && lastMessage.actionStatus !== 'PENDING';

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [persistedMessages.length, streamingText]);

  function handleSend(content: string) {
    if (!content.trim() || isStreaming) return;
    send(content);
    setDraft('');
  }

  if (isLoading) {
    return (
      <div className="flex-1 space-y-3 p-4">
        <Skeleton className="h-10 w-2/3 rounded-2xl" />
        <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
        <Skeleton className="h-16 w-3/4 rounded-2xl" />
      </div>
    );
  }

  const showSuggestions = persistedMessages.length === 0 && pendingMessages.length === 0 && !isStreaming;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-end px-1 pb-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-muted-foreground"
          disabled={persistedMessages.length === 0}
          onClick={() =>
            clearConversation.mutate(conversationId, {
              onSuccess: () => toast.success('Conversation cleared.'),
              onError: () => toast.error('Could not clear this conversation.'),
            })
          }
        >
          <Trash2 className="size-3.5" /> Clear
        </Button>
      </div>

      {showSuggestions ? (
        <SuggestedPrompts onSelect={handleSend} />
      ) : (
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-1 pb-2">
          {(persistedMessages as AiMessage[]).map((message) => (
            <React.Fragment key={message.id}>
              <MessageBubble role={message.role} content={message.content} />
              {message.actionPayload && (
                <ActionConfirmationCard conversationId={conversationId} messageId={message.id} action={message.actionPayload} status={message.actionStatus} />
              )}
            </React.Fragment>
          ))}
          {pendingMessages.map((message) => (
            <MessageBubble key={message.id} role={message.role} content={message.content} />
          ))}
          {isStreaming && <MessageBubble role="ASSISTANT" content={streamingText || '…'} />}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2">
        {canRegenerate && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={regenerate}>
            <RotateCcw className="size-3.5" /> Regenerate
          </Button>
        )}
      </div>

      <form
        className="mt-2 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(draft);
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(draft);
            }
          }}
          placeholder="Ask the AI assistant…"
          rows={1}
          className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {isStreaming ? (
          <Button type="button" size="icon" variant="outline" onClick={stop} aria-label="Stop generation">
            <Square className="size-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send message">
            <Send className="size-4" />
          </Button>
        )}
      </form>
    </div>
  );
}
