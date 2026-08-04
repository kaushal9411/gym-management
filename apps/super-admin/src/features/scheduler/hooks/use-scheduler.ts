'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AdminServiceError } from '@/features/auth/types';
import { adminSchedulerService } from '../services/scheduler.service';
import type { JobCategory, JobRunStatus } from '../types';

export function toSchedulerError(error: unknown): AdminServiceError {
  if (error instanceof AdminServiceError) return error;
  return new AdminServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

const POLL_MS = 5000;

export function useSchedulerDashboard() {
  return useQuery({ queryKey: ['admin', 'scheduler', 'dashboard'], queryFn: () => adminSchedulerService.getDashboard(), refetchInterval: POLL_MS });
}

export function useSchedulerJobs(params: { category?: JobCategory; page: number; limit: number }) {
  return useQuery({ queryKey: ['admin', 'scheduler', 'jobs', params], queryFn: () => adminSchedulerService.listJobs(params), refetchInterval: POLL_MS });
}

export function useSchedulerJob(name: string) {
  return useQuery({
    queryKey: ['admin', 'scheduler', 'jobs', name],
    queryFn: () => adminSchedulerService.getJobDetails(name),
    enabled: !!name,
    refetchInterval: POLL_MS,
  });
}

export function useSchedulerJobHistory(params: { jobName?: string; status?: JobRunStatus; page: number; limit: number }) {
  return useQuery({ queryKey: ['admin', 'scheduler', 'history', params], queryFn: () => adminSchedulerService.getJobHistory(params) });
}

export function useSchedulerFailedJobs(params: { page: number; limit: number }) {
  return useQuery({ queryKey: ['admin', 'scheduler', 'failed', params], queryFn: () => adminSchedulerService.getFailedJobs(params), refetchInterval: POLL_MS });
}

export function useSchedulerQueues() {
  return useQuery({ queryKey: ['admin', 'scheduler', 'queues'], queryFn: () => adminSchedulerService.getQueueStatuses(), refetchInterval: POLL_MS });
}

function useSchedulerJobMutation(fn: (name: string) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'scheduler'] }),
  });
}

export function useTriggerJob() {
  return useSchedulerJobMutation((name) => adminSchedulerService.triggerJob(name));
}
export function usePauseJob() {
  return useSchedulerJobMutation((name) => adminSchedulerService.pauseJob(name));
}
export function useResumeJob() {
  return useSchedulerJobMutation((name) => adminSchedulerService.resumeJob(name));
}
export function useCancelJob() {
  return useSchedulerJobMutation((name) => adminSchedulerService.cancelJob(name));
}
export function useRetryFailedJob() {
  return useSchedulerJobMutation((name) => adminSchedulerService.retryFailedJob(name));
}

function useSchedulerQueueMutation<T>(fn: (queueName: string) => Promise<T>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'scheduler'] }),
  });
}

export function useRetryQueue() {
  return useSchedulerQueueMutation((queueName) => adminSchedulerService.retryQueue(queueName));
}
export function useClearQueue() {
  return useSchedulerQueueMutation((queueName) => adminSchedulerService.clearQueue(queueName));
}
export function usePauseQueue() {
  return useSchedulerQueueMutation((queueName) => adminSchedulerService.pauseQueue(queueName));
}
export function useResumeQueue() {
  return useSchedulerQueueMutation((queueName) => adminSchedulerService.resumeQueue(queueName));
}
