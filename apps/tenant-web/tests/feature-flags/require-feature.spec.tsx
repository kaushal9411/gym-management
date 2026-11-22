import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const state = vi.hoisted(() => ({ flags: [] as string[] }));
vi.mock('@/features/tenant/tenant-provider', () => ({
  useTenant: () => ({ featureFlags: state.flags }),
}));

import { RequireFeature } from '@/features/auth/guards/require-feature';

function render(flags: string[], feature: string): string {
  state.flags = flags;
  return renderToStaticMarkup(
    React.createElement(RequireFeature, { feature, fallback: React.createElement('i', null, 'FALLBACK') }, React.createElement('b', null, 'CONTENT')),
  );
}

/**
 * `<RequireFeature>` is the generic component-level feature guard; it reads `tenant.featureFlags` (an absent key means OFF).
 */
describe('<RequireFeature> guard', () => {
  it('flag disabled -> renders the fallback, not the content', () => {
    const html = render(['members'], 'income');
    expect(html).toContain('FALLBACK');
    expect(html).not.toContain('CONTENT');
  });

  // Was a KNOWN GAP (guard read the nonexistent tenant.features); fixed to tenant.featureFlags.includes(...)
  it('flag enabled -> renders the content', () => {
    const html = render(['income'], 'income');
    expect(html).toContain('CONTENT');
  });
});
