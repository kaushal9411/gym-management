import { describe, expect, it } from 'vitest';

import { DEFAULT_TEMPLATES } from '../../tenant-notifications/constants/default-templates';

import { AUTOMATION_KEYS, AUTOMATION_RULES } from './automation-rules';

describe('automation rules <-> notification templates', () => {
  it('every rule is linked to an existing Notification template, so Settings can edit and switch it off', () => {
    for (const key of AUTOMATION_KEYS) {
      const type = AUTOMATION_RULES[key].legacyTemplate;
      expect(type, key).toBeDefined();
      expect(DEFAULT_TEMPLATES[type!], key).toBeDefined();
    }
  });

  it('a rule\'s template starts with the rule\'s own default text unless the rule shares an older template', () => {
    for (const key of ['PAYMENT_OVERDUE', 'INVOICE_DUE_SOON', 'CLASS_REMINDER', 'CLASS_SCHEDULED_OR_CHANGED', 'WE_MISS_YOU'] as const) {
      const def = AUTOMATION_RULES[key];
      expect(DEFAULT_TEMPLATES[def.legacyTemplate!].titleTemplate).toBe(def.defaultTitle);
      expect(DEFAULT_TEMPLATES[def.legacyTemplate!].bodyTemplate).toBe(def.defaultBody);
    }
  });
});
