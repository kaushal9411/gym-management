'use client';

import * as React from 'react';
import { CheckCircle2, Loader2, PartyPopper } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FormAlert } from '@/features/auth/components/form-alert';
import { StatusScreen } from '@/features/auth/components/status-screen';
import { toOnboardingError, useCreateTenant } from '../../hooks/use-onboarding';
import { onboardingService } from '../../services/onboarding.service';
import { buildOnboardingHandoffUrl } from '../../utils/portal-url';
import { useOnboardingWizard } from '../../store/onboarding-wizard-context';

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'fitcloud.local';

/** Login URL on the freshly-provisioned subdomain — same host logic as the token handoff, minus the tokens. */
function buildTenantLoginUrl(slug: string): string {
  const { protocol, hostname, port } = window.location;
  const isLocalDev = hostname === 'localhost' || hostname.endsWith('.localhost');
  const host = isLocalDev ? `${slug}.localhost${port ? `:${port}` : ''}` : `${slug}.${PLATFORM_DOMAIN}`;
  return `${protocol}//${host}/login`;
}

const PROVISIONING_TASKS = [
  'Creating your tenant workspace',
  'Setting up your default branch',
  'Configuring roles & permissions',
  'Applying default branding & settings',
  'Creating your owner account',
];

/**
 * Provisioning itself normally completes in under a second, but some
 * networks (corporate proxy/VPN/security-scanning software intercepting
 * outgoing browser connections) add many seconds of latency before the
 * request even reaches the server — that's outside this app's control, so
 * the threshold is generous rather than reflecting the server's real work.
 */
const STUCK_AFTER_MS = 45_000;

/** Step 6 — runs automatic provisioning, then hands the owner off to their new portal, already signed in. */
export function SuccessStep() {
  const { state, dispatch } = useOnboardingWizard();
  const createTenant = useCreateTenant();
  const ranRef = React.useRef(false);
  const [stuck, setStuck] = React.useState(false);
  /** Set when status-polling confirms the tenant exists but the token response never arrived. */
  const [confirmedSlug, setConfirmedSlug] = React.useState<string | null>(null);

  const sessionId = state.sessionId;
  const subdomain = state.subdomain;

  const startOver = React.useCallback(() => {
    ranRef.current = false;
    createTenant.reset();
    setStuck(false);
    dispatch({ type: 'RESET' });
  }, [createTenant, dispatch]);

  React.useEffect(() => {
    if (ranRef.current || !sessionId || !subdomain) return;
    ranRef.current = true;
    // eslint-disable-next-line no-console
    console.log('[onboarding] DEBUG calling mutate', { sessionId, subdomain });
    createTenant.mutate(
      { sessionId, subdomain },
      {
        onSuccess: (data) => {
          // eslint-disable-next-line no-console
          console.log('[onboarding] DEBUG onSuccess fired', data);
        },
        onError: (err) => {
          // eslint-disable-next-line no-console
          console.error('[onboarding] DEBUG onError fired', err);
        },
      },
    );
    // Fires exactly once — provisioning is not idempotent-safe to retry silently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, subdomain]);

  // eslint-disable-next-line no-console
  console.log('[onboarding] DEBUG render', {
    status: createTenant.status,
    hasData: createTenant.data !== undefined,
    stuck,
  });

  // Defends against a wedged request (stale/expired session reused from a
  // previous visit, a dropped connection, etc.) that never settles as
  // either success or error — without this, the spinner+checklist above
  // would spin forever with no way out except manually clearing storage.
  React.useEffect(() => {
    if (!ranRef.current || createTenant.isSuccess || createTenant.isError) return;
    const timer = setTimeout(() => setStuck(true), STUCK_AFTER_MS);
    return () => clearTimeout(timer);
  }, [createTenant.isSuccess, createTenant.isError]);

  // Recovery path: the create-tenant response has been observed getting
  // swallowed between server and page JS (interfering local proxies). The
  // server may well have finished provisioning anyway, so while the
  // mutation is pending, poll the status endpoint; once it reports
  // "provisioned", the gym exists — send the owner to their new portal's
  // login page instead of stranding them behind a lost response.
  React.useEffect(() => {
    if (!sessionId || confirmedSlug || createTenant.isSuccess || createTenant.isError) return;
    const interval = setInterval(() => {
      if (!ranRef.current) return;
      onboardingService
        .getStatus(sessionId)
        .then((status) => {
          if (status.step === 'provisioned' && status.provisionedSlug) {
            setConfirmedSlug(status.provisionedSlug);
          }
        })
        .catch(() => undefined); // session gone or still mid-provision — keep waiting
    }, 3000);
    return () => clearInterval(interval);
  }, [sessionId, confirmedSlug, createTenant.isSuccess, createTenant.isError]);

  if (!sessionId || !subdomain) {
    return <FormAlert variant="error" message="Please complete the previous steps before continuing." />;
  }

  // Provisioning confirmed via polling but the token response was lost —
  // the automatic sign-in can't happen, so hand off to a normal login.
  if (confirmedSlug && !createTenant.isSuccess) {
    return (
      <StatusScreen
        icon={PartyPopper}
        tone="success"
        title="Your gym is ready!"
        description={`${state.gymName} was created successfully. We couldn't sign you in automatically, so please sign in with the email and password you just chose.`}
      >
        <Button asChild className="w-full">
          <a href={buildTenantLoginUrl(confirmedSlug)}>Sign in to my portal</a>
        </Button>
      </StatusScreen>
    );
  }

  if (stuck && !createTenant.isSuccess) {
    return (
      <div className="space-y-4">
        <FormAlert
          variant="error"
          title="This is taking longer than expected"
          message="Your registration session may have expired. Start over to try again."
        />
        <Button type="button" className="w-full" onClick={startOver}>
          Start over
        </Button>
      </div>
    );
  }

  if (createTenant.isError) {
    return (
      <div className="space-y-4">
        <FormAlert variant="error" message={toOnboardingError(createTenant.error).message} />
        <Button type="button" className="w-full" onClick={startOver}>
          Start over
        </Button>
      </div>
    );
  }

  if (!createTenant.isSuccess) {
    return (
      <div className="space-y-5 py-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
          <p className="text-sm font-medium">Setting up {state.gymName}…</p>
        </div>
        <ul className="mx-auto max-w-xs space-y-2 text-sm text-muted-foreground">
          {PROVISIONING_TASKS.map((task) => (
            <li key={task} className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-success/70" aria-hidden />
              {task}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const result = createTenant.data;

  // Defensive: if anything about the response shape is unexpected, show the
  // actual error instead of leaving the caller staring at nothing while the
  // exception is silently swallowed by React's render-error recovery.
  try {
    if (!result || !result.slug || !result.portalUrl || !result.accessToken || !result.refreshToken || !result.accessTokenExpiresAt) {
      throw new Error(`Incomplete provisioning result: ${JSON.stringify(result)}`);
    }
    const handoffUrl = buildOnboardingHandoffUrl(result.slug, result.portalUrl, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accessTokenExpiresAt: result.accessTokenExpiresAt,
    });
    return <ProvisionedRedirect gymName={state.gymName} slug={result.slug} handoffUrl={handoffUrl} />;
  } catch (renderError) {
    return (
      <div className="space-y-4">
        <FormAlert
          variant="error"
          title="Something went wrong finishing setup"
          message={renderError instanceof Error ? renderError.message : 'Unknown error building the handoff link.'}
        />
        <Button type="button" className="w-full" onClick={startOver}>
          Start over
        </Button>
      </div>
    );
  }
}

const AUTO_REDIRECT_DELAY_MS = 2500;

function ProvisionedRedirect({ gymName, slug, handoffUrl }: { gymName: string | null; slug: string; handoffUrl: string }) {
  React.useEffect(() => {
    const timer = setTimeout(() => window.location.assign(handoffUrl), AUTO_REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [handoffUrl]);

  return (
    <StatusScreen
      icon={PartyPopper}
      tone="success"
      title="Your gym is ready!"
      description={`${gymName} is live at ${slug}.fitcloud.com. We've emailed you a welcome message with everything you need.`}
      footnote="Redirecting you to your new portal…"
    >
      <Button asChild className="w-full">
        <a href={handoffUrl}>Go to my portal</a>
      </Button>
    </StatusScreen>
  );
}
