import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type {
  JobCategory,
  JobRunStatus,
  PaginatedResult,
  QueueStatus,
  ScheduledJob,
  ScheduledJobDetail,
  SchedulerDashboard,
  JobExecution,
} from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AdminSchedulerService {
  async getDashboard(): Promise<SchedulerDashboard> {
    try {
      const res = await apiClient.get<ApiEnvelope<SchedulerDashboard>>('/admin/scheduler/dashboard');
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async listJobs(params: { category?: JobCategory; page: number; limit: number }): Promise<PaginatedResult<ScheduledJob>> {
    try {
      const res = await apiClient.get<ApiEnvelope<PaginatedResult<ScheduledJob>>>('/admin/scheduler/jobs', { params });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async getJobDetails(name: string): Promise<ScheduledJobDetail> {
    try {
      const res = await apiClient.get<ApiEnvelope<ScheduledJobDetail>>(`/admin/scheduler/jobs/${name}`);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async triggerJob(name: string): Promise<void> {
    try {
      await apiClient.post(`/admin/scheduler/jobs/${name}/trigger`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async pauseJob(name: string): Promise<void> {
    try {
      await apiClient.post(`/admin/scheduler/jobs/${name}/pause`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async resumeJob(name: string): Promise<void> {
    try {
      await apiClient.post(`/admin/scheduler/jobs/${name}/resume`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async cancelJob(name: string): Promise<void> {
    try {
      await apiClient.post(`/admin/scheduler/jobs/${name}/cancel`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async retryFailedJob(name: string): Promise<void> {
    try {
      await apiClient.post(`/admin/scheduler/jobs/${name}/retry`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async getJobHistory(params: { jobName?: string; status?: JobRunStatus; page: number; limit: number }): Promise<PaginatedResult<JobExecution>> {
    try {
      const res = await apiClient.get<ApiEnvelope<PaginatedResult<JobExecution>>>('/admin/scheduler/jobs/history', { params });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async getFailedJobs(params: { page: number; limit: number }): Promise<PaginatedResult<JobExecution>> {
    try {
      const res = await apiClient.get<ApiEnvelope<PaginatedResult<JobExecution>>>('/admin/scheduler/jobs/failed', { params });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async getQueueStatuses(): Promise<QueueStatus[]> {
    try {
      const res = await apiClient.get<ApiEnvelope<QueueStatus[]>>('/admin/scheduler/queues');
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async retryQueue(queueName: string): Promise<{ retried: number }> {
    try {
      const res = await apiClient.post<ApiEnvelope<{ retried: number }>>(`/admin/scheduler/queues/${queueName}/retry`);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async clearQueue(queueName: string): Promise<void> {
    try {
      await apiClient.post(`/admin/scheduler/queues/${queueName}/clear`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async pauseQueue(queueName: string): Promise<void> {
    try {
      await apiClient.post(`/admin/scheduler/queues/${queueName}/pause`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async resumeQueue(queueName: string): Promise<void> {
    try {
      await apiClient.post(`/admin/scheduler/queues/${queueName}/resume`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const adminSchedulerService = new AdminSchedulerService();
