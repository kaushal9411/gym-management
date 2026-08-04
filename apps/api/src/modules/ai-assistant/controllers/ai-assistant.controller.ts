import type { Request, Response } from 'express';

import { env } from '../../../config/env';
import { ValidationError } from '../../../core/errors/app-error';
import { sendSuccess } from '../../../core/http/response';
import { logger } from '../../../core/logging/logger';
import { actorFrom } from '../../authentication/utils/actor.util';
import type { AiActionProposal } from '../constants/action-types';
import { executeAiAction } from '../services/ai-actions.service';
import { AiChatService } from '../services/ai-chat.service';

function serviceFor(req: Request): AiChatService {
  return new AiChatService(req.tenant!.id);
}

export class AiAssistantController {
  async getConfig(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, {
      provider: env.ai.provider,
      model: env.ai.model,
      temperature: env.ai.temperature,
      maxTokens: env.ai.maxTokens,
      isConfigured: env.ai.isConfigured,
    });
  }

  async listConversations(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    sendSuccess(res, await serviceFor(req).listConversations(req.auth!.sub, page, limit));
  }

  async createConversation(req: Request, res: Response): Promise<void> {
    const conversation = await serviceFor(req).createConversation(req.auth!.sub);
    sendSuccess(res, conversation, 'Conversation started.', 201);
  }

  async getConversation(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getConversation(req.auth!.sub, req.params.id!));
  }

  async deleteConversation(req: Request, res: Response): Promise<void> {
    await serviceFor(req).deleteConversation(req.auth!.sub, req.params.id!);
    sendSuccess(res, null, 'Conversation deleted.');
  }

  async clearConversation(req: Request, res: Response): Promise<void> {
    await serviceFor(req).clearConversation(req.auth!.sub, req.params.id!);
    sendSuccess(res, null, 'Conversation cleared.');
  }

  /** Non-streaming "Send Message" — drains the same generator the streaming endpoint uses, just without emitting SSE along the way. */
  async sendMessage(req: Request, res: Response): Promise<void> {
    const { content } = req.body as { content: string };
    const service = serviceFor(req);
    const actor = actorFrom(req);

    let result: { messageId: string; content: string; action: AiActionProposal | null } | null = null;
    for await (const event of service.respond(actor, req.tenant!.name, req.params.id!, content, false)) {
      if (event.type === 'done') result = event;
      if (event.type === 'error') throw new ValidationError(event.message);
    }
    sendSuccess(res, result, 'Message sent.', 201);
  }

  /** SSE streaming — "Stream Response" + "Regenerate Response" (via `{regenerate: true}` in the body) share this one endpoint. */
  async streamMessage(req: Request, res: Response): Promise<void> {
    const { content, regenerate } = req.body as { content?: string; regenerate: boolean };
    const service = serviceFor(req);
    const actor = actorFrom(req);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const controller = new AbortController();
    req.on('close', () => controller.abort());

    try {
      for await (const event of service.respond(actor, req.tenant!.name, req.params.id!, content ?? null, regenerate, controller.signal)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      logger.error('AI stream endpoint failed', { error: (error as Error).message });
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'The AI assistant could not complete this request.' })}\n\n`);
    } finally {
      res.end();
    }
  }

  async confirmAction(req: Request, res: Response): Promise<void> {
    const service = serviceFor(req);
    const actor = actorFrom(req);
    const message = await service.getPendingAction(req.auth!.sub, req.params.id!, req.params.messageId!);
    const proposal = message.actionPayload as unknown as AiActionProposal;

    try {
      const resultSummary = await executeAiAction(req.tenant!.id, actor, proposal);
      await service.markActionStatus(message.id, 'CONFIRMED');
      await service.appendSystemNote(req.params.id!, resultSummary);
      sendSuccess(res, { result: resultSummary }, 'Action completed.');
    } catch (error) {
      await service.appendSystemNote(req.params.id!, `Action failed: ${(error as Error).message}`);
      throw error;
    }
  }

  async cancelAction(req: Request, res: Response): Promise<void> {
    const service = serviceFor(req);
    const message = await service.getPendingAction(req.auth!.sub, req.params.id!, req.params.messageId!);
    await service.markActionStatus(message.id, 'CANCELLED');
    sendSuccess(res, null, 'Action cancelled.');
  }
}

export const aiAssistantController = new AiAssistantController();
