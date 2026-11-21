/**
 * Schema for the well-known system settings. Each setting is stored as ONE JSON object under its `system_settings` key
 * (unchanged API); the page renders the field list below as a labelled form instead of a raw JSON textarea.
 * Keys not listed here but already stored in a setting are preserved untouched on save (merge, never drop).
 */
export type SettingFieldType = 'text' | 'number' | 'boolean' | 'select' | 'secret' | 'textarea';

export interface SettingField {
  key: string;
  label: string;
  type: SettingFieldType;
  help?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface SettingMeta {
  key: string;
  category: 'company' | 'platform';
  label: string;
  description: string;
  fields: SettingField[];
}

export const KNOWN_SETTINGS: SettingMeta[] = [
  {
    key: 'company_info', category: 'company', label: 'Company Information', description: 'The support email appears in the footer of every email the platform itself sends (sign-up codes, announcements, contact replies).',
    fields: [
      { key: 'name', label: 'Company name', type: 'text', placeholder: 'FitCloud Inc.' },
      { key: 'supportEmail', label: 'Support email', type: 'text', placeholder: 'support@example.com', help: 'Shown as “Questions? …” in platform emails. Leave blank to hide it.' },
      { key: 'website', label: 'Website', type: 'text', placeholder: 'https://example.com' },
    ],
  },
  {
    key: 'maintenance_mode', category: 'platform', label: 'Maintenance Mode', description: 'Pauses every gym portal for everyone (staff and members) and shows them this message. Takes effect within seconds; the super admin portal keeps working so you can switch it off.',
    fields: [
      { key: 'enabled', label: 'Maintenance mode on', type: 'boolean', help: 'While on, every gym portal and mobile app shows the maintenance screen.' },
      { key: 'message', label: 'Message', type: 'textarea', placeholder: 'We will be back shortly.' },
    ],
  },
];

export const CATEGORY: Record<SettingMeta['category'], { label: string; blurb: string; accent: string }> = {
  company: { label: 'Company', blurb: 'Who the platform is.', accent: 'var(--chart-1)' },
  platform: { label: 'Platform', blurb: 'Platform-wide switches.', accent: 'var(--chart-4)' },
};

export type SettingObject = Record<string, unknown>;

export const isPlainObject = (v: unknown): v is SettingObject => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The stored value as an editable object (non-object legacy values are treated as empty). */
export const toObject = (v: unknown): SettingObject => (isPlainObject(v) ? v : {});

/** Order-insensitive deep equality via sorted-key serialisation. */
export function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (isPlainObject(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'null';
}

export const SECRET_MASK = '••••••';

/** JSON shown in the "Advanced" editor: stored secrets are masked so they never appear in clear text. */
export function maskSecrets(obj: SettingObject, fields: SettingField[]): SettingObject {
  const out = { ...obj };
  for (const f of fields) if (f.type === 'secret' && typeof out[f.key] === 'string' && out[f.key] !== '') out[f.key] = SECRET_MASK;
  return out;
}

/** Inverse of maskSecrets: a secret left as the mask keeps its stored value. */
export function unmaskSecrets(parsed: SettingObject, base: SettingObject, fields: SettingField[]): SettingObject {
  const out = { ...parsed };
  for (const f of fields) {
    if (f.type !== 'secret' || out[f.key] !== SECRET_MASK) continue;
    if (f.key in base) out[f.key] = base[f.key]; else delete out[f.key];
  }
  return out;
}
