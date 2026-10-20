import { sweepClassReminders, sweepWeMissYou } from '../../communications/services/automation-sweeps.service';
import { runCommunicationsDispatch } from '../../communications/services/campaign-sweeper.service';
import type { JobHandler } from '../types';

/** Every minute: start due scheduled campaigns, release quiet-hours-held messages, recover stalled sends. */
export const communicationsDispatch: JobHandler = async () => runCommunicationsDispatch();

/** Every 15 minutes: class reminders (default 24 h and 2 h before a booked class) per the gym's `CLASS_REMINDER` rule. */
export const classReminders: JobHandler = async () => sweepClassReminders();

/** Daily: "We miss you" nudges - OFF by default, only gyms that switched the `WE_MISS_YOU` rule on are scanned. */
export const weMissYou: JobHandler = async () => sweepWeMissYou();
