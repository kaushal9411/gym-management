'use client';

import * as React from 'react';
import { CheckCircle2, Loader2, PartyPopper } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FormAlert } from '@/features/auth/components/form-alert';
import { StatusScreen } from '@/features/auth/components/status-screen';
import { toOnboardingError } from '../../hooks/use-onboarding';
import { onboardingService } from '../../services/onboarding.service';
import type { ProvisioningResult } from '../../types';
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

/**
 * Local provisioning state — deliberately NOT useMutation. This is the one
 * call in the wizard fired from a mount effect rather than a user event,
 * and under React StrictMode's double-invoked effects the mutation observer
 * was seen never leaving `pending` even though the mutationFn resolved
 * (verified with an instrumented headless-browser run: fetch 201, JSON
 * parsed, promise returned — mutation still pending forever). A plain
 * promise + setState has no observer layer to lose the result.
 */
type Provisioning =
  | { status: 'pending' }
  | { status: 'success'; result: ProvisioningResult }
  | { status: 'error'; message: string };

/** Step 6 — runs automatic provisioning, then hands the owner off to their new portal, already signed in. */
export function SuccessStep() {
  const { state, dispatch } = useOnboardingWizard();
  const ranRef = React.useRef(false);
  const [provisioning, setProvisioning] = React.useState<Provisioning>({ status: 'pending' });
  const [stuck, setStuck] = React.useState(false);
  /** Set when status-polling confirms the tenant exists but the token response never arrived. */
  const [confirmedSlug, setConfirmedSlug] = React.useState<string | null>(null);

  const sessionId = state.sessionId;
  const subdomain = state.subdomain;
  const isSettled = provisioning.status !== 'pending';

  const startOver = React.useCallback(() => {
    ranRef.current = false;
    setProvisioning({ status: 'pending' });
    setStuck(false);
    setConfirmedSlug(null);
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  React.useEffect(() => {
    if (ranRef.current || !sessionId || !subdomain) return;
    // Fires exactly once — provisioning is not idempotent-safe to retry silently.
    ranRef.current = true;
    onboardingService
      .createTenant(sessionId, subdomain)
      .then((result) => setProvisioning({ status: 'success', result }))
      .catch((error) => setProvisioning({ status: 'error', message: toOnboardingError(error).message }));
  }, [sessionId, subdomain]);

  // Defends against a wedged request (stale/expired session reused from a
  // previous visit, a dropped connection, etc.) that never settles as
  // either success or error — without this, the spinner+checklist above
  // would spin forever with no way out except manually clearing storage.
  React.useEffect(() => {
    if (isSettled) return;
    const timer = setTimeout(() => setStuck(true), STUCK_AFTER_MS);
    return () => clearTimeout(timer);
  }, [isSettled]);

  // Recovery path: if the create-tenant response is lost in transit, the
  // server may well have finished provisioning anyway — poll the status
  // endpoint while waiting; once it reports "provisioned", the gym exists,
  // so send the owner to their new portal's login page instead of
  // stranding them behind a lost response.
  React.useEffect(() => {
    if (!sessionId || confirmedSlug || isSettled) return;
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
  }, [sessionId, confirmedSlug, isSettled]);

  if (!sessionId || !subdomain) {
    return <FormAlert variant="error" message="Please complete the previous steps before continuing." />;
  }

  // Provisioning confirmed via polling but the token response was lost —
  // the automatic sign-in can't happen, so hand off to a normal login.
  if (confirmedSlug && provisioning.status !== 'success') {
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

  if (stuck && provisioning.status === 'pending') {
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

  if (provisioning.status === 'error') {
    return (
      <div className="space-y-4">
        <FormAlert variant="error" message={provisioning.message} />
        <Button type="button" className="w-full" onClick={startOver}>
          Start over
        </Button>
      </div>
    );
  }

  if (provisioning.status !== 'success') {
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

  const result = provisioning.result;
  const handoffUrl = buildOnboardingHandoffUrl(result.slug, result.portalUrl, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    accessTokenExpiresAt: result.accessTokenExpiresAt,
  });
  return <ProvisionedRedirect gymName={state.gymName} slug={result.slug} handoffUrl={handoffUrl} />;
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
