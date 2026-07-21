import swaggerJsdoc from 'swagger-jsdoc';

import { env } from '../../config/env';

/**
 * OpenAPI 3.0 spec generated from JSDoc @openapi blocks colocated with
 * each route file (single source of truth — routes can't drift from docs
 * without the docs also changing). Served at /api/docs (UI) and
 * /api/docs.json (raw spec, importable into Postman).
 */
export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'FitCloud API — Authentication & Authorization',
      version: env.apiVersion,
      description:
        'Multi-tenant gym management SaaS — authentication module. Tenant is always resolved from the subdomain (or X-Tenant-Slug for non-browser clients); never pass a tenant id explicitly.',
    },
    servers: [{ url: `/api/${env.apiVersion}`, description: 'Current API version' }],
    tags: [{ name: 'Authentication', description: 'Registration, login, tokens, verification, sessions' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', nullable: true },
            errors: {
              type: 'array',
              nullable: true,
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
            timestamp: { type: 'string', format: 'date-time' },
            requestId: { type: 'string', format: 'uuid' },
          },
        },
        UserProfile: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['PENDING_VERIFICATION', 'ACTIVE', 'LOCKED', 'SUSPENDED', 'DEACTIVATED'] },
            roles: { type: 'array', items: { type: 'string' } },
            permissions: { type: 'array', items: { type: 'string' } },
            emailVerifiedAt: { type: 'string', format: 'date-time', nullable: true },
            lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AuthSuccess: {
          type: 'object',
          properties: {
            user: { $ref: '#/components/schemas/UserProfile' },
            accessToken: { type: 'string' },
            accessTokenExpiresAt: { type: 'string', format: 'date-time' },
            refreshToken: { type: 'string', description: 'Also set as an httpOnly cookie for browser clients' },
          },
        },
      },
      responses: {
        ValidationError: {
          description: 'Request failed validation',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
        Unauthorized: {
          description: 'Missing, invalid, or expired credentials',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
        Forbidden: {
          description: 'Authenticated but not permitted',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
        RateLimited: {
          description: 'Too many requests',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },
  // Match whichever form is actually running — mixing both risks scanning a
  // stale dist/ build that has drifted from src/ and crashing the YAML parser.
  apis: [__filename.endsWith('.ts') ? './src/modules/**/routes/*.routes.ts' : './dist/modules/**/routes/*.routes.js'],
});
