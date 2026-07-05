import type { PaymentStatus } from '@prisma/client';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { adminPaymentRepository } from '../repositories/admin-payment.repository';

export class AdminPaymentService {
  async list(params: { status?: PaymentStatus; page: number; limit: number }) {
    const skip = (params.page - 1) * params.limit;
    const { total, items } = await adminPaymentRepository.list({ status: params.status, skip, take: params.limit });
    return { items, page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) };
  }

  async getById(id: string) {
    const payment = await adminPaymentRepository.findById(id);
    if (!payment) throw new AppError(ErrorCode.NOT_FOUND, 'Payment not found', 404);
    return payment;
  }

  async listInvoices(params: { page: number; limit: number }) {
    const skip = (params.page - 1) * params.limit;
    const { total, items } = await adminPaymentRepository.listInvoices({ skip, take: params.limit });
    return { items, page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) };
  }
}

export const adminPaymentService = new AdminPaymentService();
