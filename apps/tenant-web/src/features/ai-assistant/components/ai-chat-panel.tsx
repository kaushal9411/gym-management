'use client';

import * as React from 'react';
import { ArrowLeft, Bot, History } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { AiSettingsDialog } from './ai-settings-dialog';
import { ChatWindow } from './chat-window';
import { ConversationList } from './conversation-list';
import { useCreateAiConversation } from '../hooks/use-ai-assistant';

interface AiChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiChatPanel({ open, onOpenChange }: AiChatPanelProps) {
  const [view, setView] = React.useState<'list' | 'chat'>('list');
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const createConversation = useCreateAiConversation();

  function handleNew() {
    createConversation.mutate(undefined, {
      onSuccess: (conversation) => {
        setActiveConversationId(conversation.id);
        setView('chat');
      },
      onError: () => toast.error('Could not start a new conversation.'),
    });
  }

  function handleSelect(conversationId: string) {
    setActiveConversationId(conversationId);
    setView('chat');
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" className="flex w-full max-w-md flex-col sm:max-w-lg">
        <DrawerHeader className="flex-row items-center justify-between space-y-0 pr-8">
          <div className="flex items-center gap-2">
            {view === 'chat' && (
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setView('list')} aria-label="Back to conversations">
                <ArrowLeft className="size-4" />
              </Button>
            )}
            <Bot className="size-4 text-primary" aria-hidden />
            <DrawerTitle className="text-base">AI Business Assistant</DrawerTitle>
          </div>
          <div className="flex items-center gap-1">
            {view === 'chat' && (
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setView('list')} aria-label="Conversation history">
                <History className="size-4" />
              </Button>
            )}
            <AiSettingsDialog />
          </div>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          {view === 'list' || !activeConversationId ? (
            <ConversationList activeConversationId={activeConversationId} onSelect={handleSelect} onNew={handleNew} />
          ) : (
            <ChatWindow conversationId={activeConversationId} />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
