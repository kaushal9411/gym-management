import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import type { ReportFilters, ReportType } from '../dto/reports.dto';
import { ReportExportService } from '../services/report-export.service';
import { ReportsService } from '../services/reports.service';

function serviceFor(req: Request): ReportsService {
  return new ReportsService(req.tenant!.id);
}

function exportServiceFor(req: Request): ReportExportService {
  return new ReportExportService(req.tenant!.id);
}

function filtersFrom(req: Request): ReportFilters {
  return req.query as unknown as ReportFilters;
}

export class ReportsController {
  async membership(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).membershipReport(req.auth!.sub, filtersFrom(req)));
  }

  async attendance(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).attendanceReport(req.auth!.sub, filtersFrom(req)));
  }

  async revenue(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).revenueReport(req.auth!.sub, filtersFrom(req)));
  }

  async expenses(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).expenseReport(req.auth!.sub, filtersFrom(req)));
  }

  async payments(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).paymentReport(req.auth!.sub, filtersFrom(req)));
  }

  async staff(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).staffReport(req.auth!.sub, filtersFrom(req)));
  }

  async trainerPerformance(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).trainerPerformanceReport(req.auth!.sub, filtersFrom(req)));
  }

  async memberProgress(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).memberProgressReport(req.auth!.sub, filtersFrom(req)));
  }

  async branchPerformance(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).branchPerformanceReport(req.auth!.sub, filtersFrom(req)));
  }

  async expiringMemberships(req: Request, res: Response): Promise<void> {
    const filters = { ...filtersFrom(req), withinDays: req.query.withinDays ? Number(req.query.withinDays) : undefined };
    sendSuccess(res, await serviceFor(req).expiringMembershipReport(req.auth!.sub, filters));
  }

  async activeVsInactive(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).activeVsInactiveReport(req.auth!.sub, filtersFrom(req)));
  }

  async export(req: Request, res: Response): Promise<void> {
    const reportType = req.params.reportType as ReportType;
    const format = req.query.format as 'csv' | 'xlsx' | 'pdf';
    const filters = filtersFrom(req);
    const exportService = exportServiceFor(req);

    if (format === 'csv') {
      const { filename, content } = await exportService.exportCsv(reportType, req.auth!.sub, filters);
      res.status(200).setHeader('Content-Type', 'text/csv; charset=utf-8').setHeader('Content-Disposition', `attachment; filename="${filename}"`).send(content);
      return;
    }
    if (format === 'xlsx') {
      const { filename, content } = await exportService.exportExcel(reportType, req.auth!.sub, filters);
      res
        .status(200)
        .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        .send(Buffer.from(content));
      return;
    }
    const { filename, content } = await exportService.exportPdf(reportType, req.auth!.sub, filters);
    res.status(200).setHeader('Content-Type', 'application/pdf').setHeader('Content-Disposition', `attachment; filename="${filename}"`).send(content);
  }
}

export const reportsController = new ReportsController();
