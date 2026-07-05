import { Router } from 'express';
import { z } from 'zod';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminReferenceDataController } from '../controllers/admin-reference-data.controller';

export const adminReferenceDataRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

const codeParamSchema = z.object({ code: z.string().trim().min(2).max(3) });
const upsertCountrySchema = z.object({ name: z.string().trim().min(1).max(100), isActive: z.boolean().default(true) });
const upsertCurrencySchema = z.object({ name: z.string().trim().min(1).max(60), symbol: z.string().trim().min(1).max(8), isActive: z.boolean().default(true) });
const upsertTaxRuleSchema = z.object({
  countryCode: z.string().trim().length(2).toUpperCase(),
  stateCode: z.string().trim().max(10).optional(),
  label: z.string().trim().min(1).max(80),
  ratePercent: z.coerce.number().min(0).max(100),
  isActive: z.boolean().default(true),
});
const taxRuleIdParamSchema = z.object({ taxRuleId: z.string().uuid() });

adminReferenceDataRouter.use(adminAuthenticateMiddleware, requireAdminPermission('reference-data:manage'));

/** @openapi { "/admin/reference-data/countries": { get: { tags: [Admin Reference Data], summary: List countries, security: [{bearerAuth: []}], responses: { 200: { description: Countries } } } } } */
adminReferenceDataRouter.get('/countries', asyncHandler(adminReferenceDataController.listCountries.bind(adminReferenceDataController)));

/** @openapi { "/admin/reference-data/countries/{code}": { put: { tags: [Admin Reference Data], summary: Create/update a country, security: [{bearerAuth: []}], responses: { 200: { description: Saved } } } } } */
adminReferenceDataRouter.put(
  '/countries/:code',
  validate({ params: codeParamSchema, body: upsertCountrySchema }),
  asyncHandler(adminReferenceDataController.upsertCountry.bind(adminReferenceDataController)),
);

/** @openapi { "/admin/reference-data/currencies": { get: { tags: [Admin Reference Data], summary: List currencies, security: [{bearerAuth: []}], responses: { 200: { description: Currencies } } } } } */
adminReferenceDataRouter.get('/currencies', asyncHandler(adminReferenceDataController.listCurrencies.bind(adminReferenceDataController)));

/** @openapi { "/admin/reference-data/currencies/{code}": { put: { tags: [Admin Reference Data], summary: Create/update a currency, security: [{bearerAuth: []}], responses: { 200: { description: Saved } } } } } */
adminReferenceDataRouter.put(
  '/currencies/:code',
  validate({ params: codeParamSchema, body: upsertCurrencySchema }),
  asyncHandler(adminReferenceDataController.upsertCurrency.bind(adminReferenceDataController)),
);

/** @openapi { "/admin/reference-data/tax-rules": { get: { tags: [Admin Reference Data], summary: List tax rules, security: [{bearerAuth: []}], responses: { 200: { description: Tax rules } } } } } */
adminReferenceDataRouter.get('/tax-rules', asyncHandler(adminReferenceDataController.listTaxRules.bind(adminReferenceDataController)));

/** @openapi { "/admin/reference-data/tax-rules": { put: { tags: [Admin Reference Data], summary: Create/update a tax rule, security: [{bearerAuth: []}], responses: { 200: { description: Saved } } } } } */
adminReferenceDataRouter.put(
  '/tax-rules',
  validate({ body: upsertTaxRuleSchema }),
  asyncHandler(adminReferenceDataController.upsertTaxRule.bind(adminReferenceDataController)),
);

/** @openapi { "/admin/reference-data/tax-rules/{taxRuleId}": { delete: { tags: [Admin Reference Data], summary: Delete a tax rule, security: [{bearerAuth: []}], responses: { 200: { description: Deleted } } } } } */
adminReferenceDataRouter.delete(
  '/tax-rules/:taxRuleId',
  validate({ params: taxRuleIdParamSchema }),
  asyncHandler(adminReferenceDataController.removeTaxRule.bind(adminReferenceDataController)),
);
