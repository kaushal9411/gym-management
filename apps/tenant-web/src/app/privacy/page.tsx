import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy Policy' };

interface CmsPageApiResponse {
  success: boolean;
  data: Array<{ title: string; content: { body?: string } }>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** Same pattern as `app/terms/page.tsx` — see its doc comment. Fetches the published `PRIVACY` CMS page. */
async function getPrivacyPage() {
  try {
    const res = await fetch(`${API_URL}/public/cms/pages?type=PRIVACY`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const body = (await res.json()) as CmsPageApiResponse;
    return body.data?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * The platform's own privacy policy — shown whenever no tenant has published
 * a CMS override for this page (i.e. almost always; a tenant CMS page here
 * would be that GYM's own custom policy, a different, rarer thing). Without
 * this fallback, the route rendered "This page hasn't been published yet"
 * by default, which is unusable as the one stable, always-on URL Google
 * Play's app listing and Data Safety form require — a store submission
 * can't depend on a tenant admin having filled in a CMS page first.
 *
 * Real company details filled in (2026-09-23) — still recommend a legal
 * review pass for the target jurisdiction before Play Store submission;
 * see docs/PRIVACY-POLICY-DRAFT.md for the pre-submission checklist.
 */
const FALLBACK_PRIVACY_POLICY = `Last updated: September 23, 2026

## Who this applies to

FitCloud ("we", "us", "the App") is a gym-management platform. This policy covers the FitCloud mobile app and the tenant-web/super-admin portals. Gym businesses ("Tenants") use FitCloud to manage their own members and staff; each Tenant is the data controller for its own members' information, and FitCloud acts as the data processor operating the platform on the Tenant's behalf, unless stated otherwise below.

## Information we collect

Account & profile information (staff and gym owners): name, email, phone number, employee ID, role, employment details, profile photo.

Member information (collected by gym staff on a member's behalf, or by the member themselves via the self-service portal): full name, member ID, phone number, email, date of birth, gender, blood group, address, emergency contact details, profile photo, and — where a gym enables it — extended onboarding details such as marital status, occupation, and how the member learned about the gym.

Health information: a pre-exercise health screening questionnaire (history of heart conditions, pain during physical activity, dizziness/balance issues, diabetes or high blood pressure, asthma, bone/joint problems, and other medical conditions or injuries), plus voluntary fitness data such as height, weight, body measurements over time, fitness goals, and workout/diet plan assignments and progress. This is sensitive health data, used solely to support safe exercise programming, and is never sold or used for advertising.

Attendance & activity: check-in/check-out timestamps, QR-code-based attendance records, class bookings, workout and diet plan progress.

Payment information: membership payment amounts, methods, and transaction references. Card/UPI/bank details themselves are handled directly by our payment processor, Razorpay, and are never stored on FitCloud's own servers or in the app.

Device & usage information: standard technical data needed to operate the app (IP address, device/OS type, crash and performance logs). The app requests camera access solely to scan QR codes for attendance check-in, and photo access solely to let you choose or take a profile photo.

## How we use this information

To provide the core service: member management, attendance tracking, membership and billing, workout/diet planning, staff management, and reporting for the Tenant gym you belong to or manage. To communicate with you (activation emails, password resets, membership and payment notifications, class/attendance reminders). To keep the platform secure. To improve the app using aggregated, non-identifying analytics only. We do not sell personal information, and we do not use health information for advertising.

## Who we share information with

The Tenant gym you're a member of, or that employs you — they own and manage the records you provide. Razorpay for payment processing — see razorpay.com/privacy. Infrastructure and email service providers, bound by confidentiality obligations. We do not share personal or health information with any other third party without your consent, except where required by law.

## Your rights

You can request a full export of the personal data held about you, request correction of incorrect details, and request deletion of your personal data. Financial records are retained as required for accounting/tax law even after an erasure request, with identifying details removed. To exercise any of these rights, contact the gym you're a member of directly, or contact us at support@fitcloud.info.

## Data retention

We retain personal data for as long as your account/membership is active and as needed to provide the service, plus any additional period required by law. Health-screening answers are retained only as long as the associated membership record.

## Data security

Passwords are never stored in plain text. Sensitive fields (member email and phone) are encrypted at rest. Access to member and health data is restricted to authorized staff at the relevant gym via role-based permissions, and all administrative changes are logged.

## Children's privacy

FitCloud is intended for users who are old enough to hold a gym membership under local law. If a gym enrolls a minor as a member, the minor's parent/guardian is responsible for providing consent, and the gym (not FitCloud) is the party managing that relationship.

## Changes to this policy

We may update this policy from time to time. Material changes will be reflected by updating the "Last updated" date above.

## Contact us

FitCloud, Sector 118, Noida, Uttar Pradesh 201301, India. support@fitcloud.info`;

function renderPolicyBody(body: string) {
  return body.split('\n\n').map((block, i) => {
    if (block.startsWith('## ')) {
      return (
        <h2 key={i} className="pt-4 text-base font-semibold text-foreground first:pt-0">
          {block.slice(3)}
        </h2>
      );
    }
    return <p key={i}>{block}</p>;
  });
}

export default async function PrivacyPage() {
  const page = await getPrivacyPage();
  const body = page?.content.body || FALLBACK_PRIVACY_POLICY;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{page?.title ?? 'Privacy Policy'}</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">{renderPolicyBody(body)}</div>
    </div>
  );
}
