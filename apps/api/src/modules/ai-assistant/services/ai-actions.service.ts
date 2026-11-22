import type { TenantNotificationCategory } from '@prisma/client';

import { ForbiddenError } from '../../../core/errors/app-error';
import type { IamActor } from '../../authentication/utils/actor.util';
import { DietPlanService } from '../../diet/services/diet-plan.service';
import { MemberService } from '../../members/services/member.service';
import { permissionEngine } from '../../permissions/services/permission-engine.service';
import type { ReportType } from '../../reports/dto/reports.dto';
import { ReportExportService } from '../../reports/services/report-export.service';
import { tenantNotificationService } from '../../tenant-notifications/services/tenant-notification.service';
import { isModuleEnabled } from '../../tenants/utils/module-enabled.util';
import { WorkoutPlanService } from '../../workouts/services/workout-plan.service';
import { ACTION_MODULES, ACTION_PERMISSIONS, MODULE_LABELS, type AiActionProposal } from '../constants/action-types';

export interface AiActionOutcome {
  /** `refused` = the action's module is switched off for this gym; nothing ran. */
  status: 'executed' | 'refused';
  message: string;
}

/**
 * Executes a previously-proposed AI action — the ONLY place any of these 6
 * write operations actually happen. Called exclusively from the confirm
 * endpoint, never from the chat/streaming path itself, so nothing ever runs
 * without the user having seen and explicitly confirmed the proposal first.
 * Every action re-checks the confirming user's permission for the matching
 * REAL domain permission (not a generic "AI actions" one) — the same
 * permission the equivalent manual UI action already requires.
 *
 * Feature flags: an action whose module the tenant has switched off (`ACTION_MODULES`) is REFUSED - nothing runs and the
 * outcome is a clear "<Feature> is disabled for this gym." message (a tool-result, not a 500). The check mirrors
 * `requireModuleEnabled` on the REST routes the same operations go through, and fails open if the flags cannot be read.
 */
export async function executeAiActionDetailed(tenantId: string, actor: IamActor, proposal: AiActionProposal): Promise<AiActionOutcome> {
  const requiredPermission = ACTION_PERMISSIONS[proposal.type];
  const allowed = await permissionEngine.hasPermission(tenantId, actor.userId, requiredPermission);
  if (!allowed) throw new ForbiddenError(`You don't have permission to ${proposal.type.replace(/_/g, ' ')} (missing "${requiredPermission}").`);

  const module = ACTION_MODULES[proposal.type];
  if (module && !(await isModuleEnabled(tenantId, module))) {
    return { status: 'refused', message: `${MODULE_LABELS[module]} is disabled for this gym.` };
  }

  return { status: 'executed', message: await runAction(tenantId, actor, proposal) };
}

/** Back-compat wrapper: the result text only (a refusal is returned as its message, never thrown). */
export async function executeAiAction(tenantId: string, actor: IamActor, proposal: AiActionProposal): Promise<string> {
  return (await executeAiActionDetailed(tenantId, actor, proposal)).message;
}

async function runAction(tenantId: string, actor: IamActor, proposal: AiActionProposal): Promise<string> {

  switch (proposal.type) {
    case 'create_member': {
      const params = proposal.params as { firstName: string; lastName: string; email?: string; phone?: string; branchId: string; planId?: string };
      const service = new MemberService(tenantId);
      const member = await service.create(
        { firstName: params.firstName, lastName: params.lastName, email: params.email, phone: params.phone, branchId: params.branchId },
        actor,
      );
      if (params.planId) {
        await service.assignMembership(member.id, { planId: params.planId }, actor);
      }
      return `Created member ${params.firstName} ${params.lastName} (${member.memberId})${params.planId ? ' and assigned the requested membership plan' : ''}.`;
    }
    case 'renew_membership': {
      const params = proposal.params as { memberId: string; planId?: string };
      const service = new MemberService(tenantId);
      const member = await service.renewMembership(params.memberId, { planId: params.planId }, actor);
      return `Renewed the membership for ${member.firstName} ${member.lastName}.`;
    }
    case 'assign_workout': {
      const params = proposal.params as { memberId: string; planId: string; startDate: string; endDate?: string };
      const service = new WorkoutPlanService(tenantId);
      await service.assign(params.planId, { memberId: params.memberId, startDate: params.startDate, endDate: params.endDate }, actor);
      return 'Assigned the workout plan.';
    }
    case 'assign_diet': {
      const params = proposal.params as { memberId: string; planId: string; startDate: string; endDate?: string };
      const service = new DietPlanService(tenantId);
      await service.assign(params.planId, { memberId: params.memberId, startDate: params.startDate, endDate: params.endDate }, actor);
      return 'Assigned the diet plan.';
    }
    case 'generate_report': {
      const params = proposal.params as { reportType: ReportType; branchId?: string };
      const service = new ReportExportService(tenantId);
      const { filename, content } = await service.exportCsv(params.reportType, actor.userId, { branchId: params.branchId });
      const rowCount = Math.max(0, content.split('\n').filter(Boolean).length - 1);
      return `Generated **${filename}** (${rowCount} row${rowCount === 1 ? '' : 's'}). Full export is available from the Reports Center.`;
    }
    case 'send_notification': {
      const params = proposal.params as { title: string; body: string; category?: string };
      await tenantNotificationService.notifyTenant(tenantId, (params.category ?? 'GENERAL') as TenantNotificationCategory, params.title, params.body);
      return `Sent the notification "${params.title}" to the Notification Center.`;
    }
    default: {
      const exhaustiveCheck: never = proposal.type;
      throw new Error(`Unhandled action type: ${String(exhaustiveCheck)}`);
    }
  }
}
