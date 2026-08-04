import type { Request, Response } from 'express';

import { ValidationError } from '../../../core/errors/app-error';
import { sendSuccess } from '../../../core/http/response';
import { logger } from '../../../core/logging/logger';
import { getEffectiveAiConfig } from '../../ai-assistant/providers/factory';
import { adminAiChatService } from '../services/admin-ai-chat.service';
import { adminAiSettingsService } from '../services/admin-ai-settings.service';

export class AdminAiAssistantController {
  async getConfig(_req: Request, res: Response): Promise<void> {
    const override = await adminAiSettingsService.resolveProviderOverride();
    const effective = getEffectiveAiConfig(override);
    sendSuccess(res, {
      provider: effective.provider,
      model: effective.model,
      temperature: effective.temperature,
      maxTokens: effective.maxTokens,
      isConfigured: effective.provider === 'ollama' || Boolean(effective.apiKey),
      usingOwnKey: Boolean(override?.apiKey),
    });
  }

  async getSettings(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminAiSettingsService.getView());
  }

  async updateSettings(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminAiSettingsService.update(req.body, req.admin!.sub), 'AI settings updated.');
  }

  async resetSettings(_req: Request, res: Response): Promise<void> {
    await adminAiSettingsService.reset();
    sendSuccess(res, null, 'Reverted to the environment-variable AI configuration.');
  }

  async listConversations(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    sendSuccess(res, await adminAiChatService.listConversations(req.admin!.sub, page, limit));
  }

  async createConversation(req: Request, res: Response): Promise<void> {
    const conversation = await adminAiChatService.createConversation(req.admin!.sub);
    sendSuccess(res, conversation, 'Conversation started.', 201);
  }

  async getConversation(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminAiChatService.getConversation(req.admin!.sub, req.params.id!));
  }

  async deleteConversation(req: Request, res: Response): Promise<void> {
    await adminAiChatService.deleteConversation(req.admin!.sub, req.params.id!);
    sendSuccess(res, null, 'Conversation deleted.');
  }

  async clearConversation(req: Request, res: Response): Promise<void> {
    await adminAiChatService.clearConversation(req.admin!.sub, req.params.id!);
    sendSuccess(res, null, 'Conversation cleared.');
  }

  async sendMessage(req: Request, res: Response): Promise<void> {
    const { content } = req.body as { content: string };
    let result: { messageId: string; content: string } | null = null;
    for await (const event of adminAiChatService.respond(req.admin!.sub, req.params.id!, content, false)) {
      if (event.type === 'done') result = event;
      if (event.type === 'error') throw new ValidationError(event.message, { code: event.code });
    }
    sendSuccess(res, result, 'Message sent.', 201);
  }

  async streamMessage(req: Request, res: Response): Promise<void> {
    const { content, regenerate } = req.body as { content?: string; regenerate: boolean };

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const controller = new AbortController();
    req.on('close', () => controller.abort());

    try {
      for await (const event of adminAiChatService.respond(req.admin!.sub, req.params.id!, content ?? null, regenerate, controller.signal)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      logger.error('Admin AI stream endpoint failed', { error: (error as Error).message });
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'The AI assistant could not complete this request.' })}\n\n`);
    } finally {
      res.end();
    }
  }
}

export const adminAiAssistantController = new AdminAiAssistantController();
