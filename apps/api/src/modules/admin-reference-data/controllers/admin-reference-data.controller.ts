import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminReferenceDataService } from '../services/admin-reference-data.service';

export class AdminReferenceDataController {
  async listCountries(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminReferenceDataService.listCountries());
  }

  async upsertCountry(req: Request, res: Response): Promise<void> {
    const { name, isActive } = req.body as { name: string; isActive: boolean };
    sendSuccess(res, await adminReferenceDataService.upsertCountry(req.params.code!, name, isActive, req.admin!.sub, req.admin!.role), 'Country saved.');
  }

  async listCurrencies(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminReferenceDataService.listCurrencies());
  }

  async upsertCurrency(req: Request, res: Response): Promise<void> {
    const { name, symbol, isActive } = req.body as { name: string; symbol: string; isActive: boolean };
    sendSuccess(res, await adminReferenceDataService.upsertCurrency(req.params.code!, name, symbol, isActive, req.admin!.sub, req.admin!.role), 'Currency saved.');
  }

  async listTaxRules(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminReferenceDataService.listTaxRules());
  }

  async upsertTaxRule(req: Request, res: Response): Promise<void> {
    const rule = await adminReferenceDataService.upsertTaxRule(
      req.body as { countryCode: string; stateCode?: string; label: string; ratePercent: number; isActive: boolean },
      req.admin!.sub,
      req.admin!.role,
    );
    sendSuccess(res, rule, 'Tax rule saved.');
  }

  async removeTaxRule(req: Request, res: Response): Promise<void> {
    await adminReferenceDataService.removeTaxRule(req.params.taxRuleId!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'Tax rule deleted.');
  }
}

export const adminReferenceDataController = new AdminReferenceDataController();
