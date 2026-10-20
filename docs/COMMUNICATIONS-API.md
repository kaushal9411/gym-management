# Communications API contract (staff + member plane)

Backend for the approved designs `docs/design/communications-web.html` and `docs/design/communications-mobile.html`.
Web and mobile agents: build against THIS file. It is kept in sync with the code (`apps/api/src/modules/communications`).

- Base: `/api/v1`. Staff routes: `Authorization: Bearer <staff JWT>` + `X-Tenant-Slug`. Member route: member JWT + `X-Tenant-Slug`.
- Every response uses the standard envelope: `{ success, message, data, errors, timestamp, requestId }`. Errors: `success:false`, `errors:[{field?,code,message}]`, and for a few cases a structured `data` payload (documented below).
- All routes are behind the `notifications` module flag (`requireModuleEnabled('notifications')`), exactly like `/notifications`.
- All request bodies are zod `.strict()` — unknown keys are a 422.
- Dates/times: ISO-8601 UTC strings. Day values are `YYYY-MM-DD`.
- Money text is INR (`₹1,500`) only.

## Permissions

| Key | New? | Gates |
|---|---|---|
| `notifications:send` | NEW | audience preview/picker, create/send/edit/cancel/retry campaigns, test-send |
| `notifications:view` | existing | overview, campaign list/detail/recipients, automations list |
| `notifications:manage` | existing | automation update + automation test |

Default grants: OWNER (wildcard), MANAGER get `notifications:send` (same roles that have `notifications:manage`). TRAINER/RECEPTIONIST do not. Custom roles must be given the key explicitly in the role editor. A user without the key gets `403 FORBIDDEN`. No token: `401`.

## Shared enums

```
Channel          = "PUSH" | "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP"      (Prisma TenantNotificationChannel)
CampaignStatus   = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "PARTIAL" | "FAILED" | "CANCELLED"
AudienceMode     = "FILTERS" | "PICKED"
RecipientStatus  = "QUEUED" | "SENT" | "FAILED" | "SKIPPED_OPTED_OUT" | "SKIPPED_NO_CONTACT"
                 | "SKIPPED_QUOTA" | "SKIPPED_DISABLED" | "CANCELLED"
SendMode         = "NOW" | "SCHEDULE" | "DRAFT"
TemplateKey      = "CUSTOM" | "MEMBERSHIP_EXPIRING" | "PAYMENT_OVERDUE" | "CLASS_UPDATE" | "SPECIAL_OFFER" | "WINTER_OFFER" | "SUMMER_OFFER" | "FESTIVE_OFFER" | "RENEWAL_OFFER" | "REFER_FRIEND" | "COMEBACK_OFFER" | "HOLIDAY_NOTICE" | "TIMING_CHANGE" | "FEEDBACK_REQUEST"   (label only; optional; the text is always what was sent)
AutomationKey    = "MEMBERSHIP_EXPIRING" | "MEMBERSHIP_EXPIRED" | "PAYMENT_OVERDUE" | "INVOICE_DUE_SOON"
                 | "PAYMENT_FAILED" | "CLASS_REMINDER" | "CLASS_SCHEDULED_OR_CHANGED" | "BIRTHDAY" | "WE_MISS_YOU"
```

Channel semantics: `PUSH` = Firebase push to the member's registered devices (also writes the in-app inbox row unless `IN_APP` is also selected); `IN_APP` = row in the member's notification inbox only; `EMAIL`, `SMS`, `WHATSAPP` = paid channels, gated per tenant (platform ceiling, then the gym's own toggle, then the monthly quota). `PUSH`/`IN_APP` are never quota-limited.

### Placeholders (campaigns)

Allowed: `{{firstName}} {{lastName}} {{memberCode}} {{planName}} {{endDate}} {{amountDue}} {{gymName}}`.
Anything else (`{{foo}}`, a malformed `{{`/`}}`) is rejected with 422 naming the offender. Filled per member: `planName` falls back to "your plan", `endDate` to "your renewal date", `amountDue` is the member's open invoice balance (`₹0` if none), dates look like `26 Oct 2026`.
Placeholders work in `title` and `body`.

### Audience filter object (`audienceFilter`, all keys optional, AND-combined, strict)

```jsonc
{
  "membershipStatus": "ACTIVE" | "EXPIRING" | "EXPIRED" | "FROZEN" | "NO_PLAN",
  "expiringWithinDays": 7,            // 1..90, only meaningful with membershipStatus "EXPIRING" (default 7)
  "planIds": ["uuid"],                // current/pending/active membership is one of these plans (max 50)
  "branchIds": ["uuid"],              // max 50 (branch-scoped staff are always intersected with their own branches)
  "trainerIds": ["uuid"],             // members assigned to one of these trainers (max 50)
  "hasTrainer": true,                 // any trainer assigned
  "hasOverdueInvoice": true,          // open invoice past its due date
  "hasUnpaidInvoice": true,           // any open (unpaid / partially paid / overdue) invoice
  "notVisitedDays": 14,               // 1..365; no check-in in the last N days (members who joined less than N days ago are excluded)
  "birthdayThisWeek": true,           // birthday within today..today+6
  "bookedClassSessionId": "uuid"      // has a BOOKED seat in that class session
}
```

Default population when no `membershipStatus` is given: members that are not deleted, with member status ACTIVE or FROZEN, whose membership has not lapsed (a member who has had memberships but none ACTIVE/PENDING is "lapsed" and only appears with `membershipStatus: "EXPIRED"`). `FROZEN` = member status FROZEN. `NO_PLAN` = never had a membership. INACTIVE members are never messaged. Branch-scoped staff (no all-branches access) can only reach members of their branches; this scope is stored on the campaign and applied again at send time.

`PICKED` mode: `pickedMemberIds` = member ids (uuid, 1..5000, deduped); every id must belong to the tenant and to a branch the staff user can reach, otherwise 404/422.

## Limits and rules (constants)

| Rule | Value |
|---|---|
| title | 1..200 chars (the SMS/WhatsApp text is `title + "\n" + body`) |
| body | 1..2000 chars; if SMS is selected, `title\nbody` max 1000 chars (GSM-7: 160 / 153 per segment; unicode: 70 / 67) |
| max recipients per campaign | 5000 members (422 `RECIPIENT_LIMIT_EXCEEDED`) |
| `confirmLargeSend:true` required above | 100 members (409 `CONFIRMATION_REQUIRED`) |
| schedule window | `scheduledAt` strictly in the future, at most 90 days ahead, at least 1 minute ahead |
| campaign send rate | 10 non-draft campaigns per hour per gym (429 `RATE_LIMITED`) |
| quiet hours | 21:00 - 08:00 in the member's BRANCH timezone, SMS + WhatsApp only, when `holdQuietHours` (default true); held rows go out at 08:00 local |
| batch size | 200 recipient-messages per queue job |

## Rate limits (all return 429 `RATE_LIMITED`, standard envelope)

| Route group | Limit (per gym + staff user) |
|---|---|
| `POST /audience/preview`, `GET /audience/members` | 120 / minute |
| campaign create / edit / send / cancel / retry-failed | 30 / 10 minutes |
| `POST /test-send`, `POST /automations/:key/test` | 10 / minute |
| `PUT /automations/:key` | 30 / 10 minutes |
| non-draft campaigns per gym | 10 / hour (message: "You can send up to 10 campaigns per hour. Try again a little later.") |
| `PUT /portal/notification-preferences` | 30 / 15 minutes per member |
| everything | the app-wide 300 / minute backstop |

## How a send behaves (what the UI should expect)

1. `POST /campaigns` (NOW) returns immediately with status `SENDING`; the work runs on a background queue. Poll `GET /campaigns/:id` (every 2-3 s while `SENDING`) - counts move as messages are handed over, and email / SMS / WhatsApp rows turn `SENT` / `FAILED` when their provider answers.
2. The audience is resolved again when the send actually starts (not at creation), so a scheduled campaign reaches whoever matches at that moment. `recipientCount` is an estimate until then.
3. Per member and channel: opted out -> `SKIPPED_OPTED_OUT`; no usable email / phone / device -> `SKIPPED_NO_CONTACT`; channel off or monthly quota used up -> `SKIPPED_DISABLED` / `SKIPPED_QUOTA` (also written to the Message Log); otherwise handed to the channel.
4. SMS and WhatsApp are never sent between 21:00 and 08:00 in the member's branch timezone when `holdQuietHours` is true: those messages stay `QUEUED` (with `heldUntil`) and go out at 08:00 local. The check runs again when a message is about to leave, so a campaign that runs past 21:00 holds its remaining SMS rather than sending them. A campaign with held messages stays `SENDING` until they are released (or cancelled).
5. Finished status: `SENT` (something delivered, no failures and no quota/disabled skips), `PARTIAL` (something delivered but some failed or were skipped for quota / channel-off), `FAILED` (nothing delivered; see `failureReason`). Opt-outs and missing contacts alone never make a campaign `PARTIAL`.
6. A message is handed over at most once; retries and restarts never double-send. A message handed to a channel queue that is never confirmed within 30 minutes is marked `FAILED`.

## Endpoints

### GET /communications/overview  (notifications:view)

Hub data (quota at a glance + recent). Response `data`:

```jsonc
{
  "periodKey": "2026-10",
  "channels": [
    { "channel": "EMAIL", "enabled": true, "disabledReason": null, "limit": 5000, "used": 1210, "remaining": 3790 },
    { "channel": "SMS", "enabled": false, "disabledReason": "disabled_platform", "limit": null, "used": 0, "remaining": null },
    { "channel": "PUSH", "enabled": true, "disabledReason": null, "limit": null, "used": 0, "remaining": null }
  ],                                    // always 5 entries in order PUSH, IN_APP, EMAIL, SMS, WHATSAPP
  "recent": [ /* up to 5 CampaignDto, newest first */ ],
  "automations": { "total": 9, "enabled": 8 },
  "quietHours": { "start": "21:00", "end": "08:00", "channels": ["SMS", "WHATSAPP"], "timezoneBasis": "member branch" }
}
```
`disabledReason`: `null | "disabled_platform" | "disabled_tenant"` (platform ceiling off / the gym's own toggle off). `limit:null` = unlimited.

### POST /communications/audience/preview  (notifications:send, 120/min)

Request:
```jsonc
{ "audienceMode": "FILTERS", "audienceFilter": { }, "pickedMemberIds": [], "channels": ["PUSH","EMAIL"], "title": "optional", "body": "optional" }
```
`channels` optional (default all five). `title`/`body` optional, only used to compute the SMS note.

Response `data`:
```jsonc
{
  "total": 412,                          // members in the audience
  "sample": [ { "id": "uuid", "memberId": "MEM-0001", "name": "Aarav K." } ],   // first 5
  "maxRecipients": 5000, "exceedsMax": false,
  "largeSend": true, "largeSendThreshold": 100,
  "channels": [
    {
      "channel": "EMAIL",
      "contactable": 390,                // members with a usable address/number/device
      "optedOut": 12,                    // of the contactable ones, promotional opt-out for this channel
      "willReceive": 378,                // contactable - optedOut  (= messages this channel would use)
      "quota": { "enabled": true, "disabledReason": null, "limit": 5000, "used": 1210, "remaining": 3790, "wouldUse": 378, "over": false, "shortBy": 0 }
    }
  ],
  "overLimit": ["SMS"],                  // channels where quota.over || !quota.enabled
  "sms": { "characters": 143, "segments": 1, "encoding": "GSM-7" }   // present only when title/body given and SMS requested
}
```
`IN_APP` contactable = everyone. `PUSH` contactable = members with a registered device. `EMAIL` = has an email on file. `SMS`/`WHATSAPP` = has a valid phone number.

### GET /communications/audience/members  (notifications:send, 120/min)

Picker. **Web and mobile should call this, not `GET /members?search=`** (it needs only `notifications:send`, applies branch scope, returns the contact flags, never returns contact values).
Query: `search` (name or member code, case-insensitive substring; an exact email or phone also matches), `branchId?`, `page=1`, `limit=20` (max 100).
Response: `{ items:[{ id, memberId, name, planName|null, branchId, branchName, membershipStatus:"ACTIVE"|"EXPIRED"|"FROZEN"|"NO_PLAN"|"PENDING", hasEmail, hasPhone, hasDevice }], page, limit, total, totalPages }`. Only messageable members (ACTIVE/FROZEN, not deleted).

### POST /communications/campaigns  (notifications:send)

Rate limit 30/10 min per user, plus the 10-per-hour-per-gym send cap. Optional header `Idempotency-Key` (<=100 chars): repeating it returns the first campaign (200 instead of 201, `idempotentReplay:true`, nothing is sent twice).

Request:
```jsonc
{
  "name": "Diwali timings",              // optional internal label (<=120); defaults to title
  "title": "Hi {{firstName}}, a note from {{gymName}}",
  "body": "We have extended weekday closing time to 10 pm.",
  "channels": ["PUSH","IN_APP","EMAIL"],
  "audienceMode": "FILTERS",
  "audienceFilter": { "membershipStatus": "EXPIRING" },
  "pickedMemberIds": ["uuid"],           // PICKED mode
  "templateKey": "CUSTOM",               // optional
  "sendMode": "NOW",                     // NOW (default) | SCHEDULE | DRAFT
  "scheduledAt": "2026-10-25T04:30:00.000Z",   // required for SCHEDULE
  "holdQuietHours": true,                // default true
  "confirmLargeSend": false              // must be true when audience > 100 (NOW / SCHEDULE)
}
```
`DRAFT` only validates the text/shape and stores; no audience resolution, quota or rate check. NOW/SCHEDULE: validates, resolves the audience, runs the quota pre-check, then starts (NOW -> status `SENDING`) or schedules (`SCHEDULED`). The audience is re-resolved at send time.

Response 201 `data` = `CampaignDto`:
```jsonc
{
  "id": "uuid", "name": "...", "title": "...", "body": "...",
  "channels": ["PUSH","EMAIL"], "audienceMode": "FILTERS", "audienceFilter": { },
  "pickedCount": 0,                       // number of picked ids (PICKED mode)
  "templateKey": "CUSTOM", "status": "SENDING",
  "scheduledAt": null, "startedAt": "...", "finishedAt": null,
  "holdQuietHours": true,
  "recipientCount": 412,                  // members (estimate until sending starts, exact afterwards)
  "messageCount": 824,                    // recipient x channel rows
  "queuedCount": 400, "sentCount": 410, "failedCount": 2, "skippedCount": 12, "cancelledCount": 0,
  "failureReason": null,
  "createdBy": { "id": "uuid", "name": "Asha" } | null,
  "createdAt": "...", "updatedAt": "...",
  "notices": ["WhatsApp ..."],            // human notes, e.g. the WhatsApp 24-hour-window limitation when WHATSAPP is selected
  "idempotentReplay": false               // only on create
}
```
Counts are MESSAGE level (one per recipient x channel) except `recipientCount`; `queuedCount` includes messages held for quiet hours.

Errors (all standard envelope):
| HTTP | code | when |
|---|---|---|
| 422 | `VALIDATION_ERROR` | `errors[]` per field: empty channels, unknown/malformed placeholder, title/body length, past or >90-day `scheduledAt`, missing `scheduledAt`, PICKED without ids, SMS text > 1000 chars, unknown body keys |
| 422 | `AUDIENCE_EMPTY` | nobody matches |
| 422 | `RECIPIENT_LIMIT_EXCEEDED` | audience > 5000 |
| 409 | `CONFIRMATION_REQUIRED` | audience > 100 without `confirmLargeSend:true`; `data:{recipientCount,threshold}` |
| 409 | `CHANNEL_DISABLED` | a chosen paid channel is off for the gym (platform ceiling or gym toggle); `data:{channels:[{channel,reason}]}` |
| 409 | `QUOTA_EXCEEDED` | a chosen channel does not have enough monthly quota; `data:{shortChannels:[{channel,remaining,wouldUse,shortBy}]}` |
| 429 | `RATE_LIMITED` | >10 campaigns/hour, or the route limiter |
| 404 | `NOT_FOUND` | picked member / plan / branch id not in this gym |
| 403 | `FORBIDDEN` | missing `notifications:send`, or a picked member outside the actor's branches |

### GET /communications/campaigns  (notifications:view)
Query: `status?` (CampaignStatus), `search?` (name/title), `page=1`, `limit=20` (max 100).
Response: `{ items: CampaignDto[], page, limit, total, totalPages, counts:{ all, draft, scheduled, sending, sent, partial, failed, cancelled } }` (counts ignore the `status` filter).

### GET /communications/campaigns/:id  (notifications:view)
`CampaignDto` plus:
```jsonc
{
  "breakdown": [ { "channel": "EMAIL", "total": 38, "queued": 0, "sent": 34, "failed": 2, "skipped": 2, "cancelled": 0 } ],
  "skippedByReason": { "SKIPPED_OPTED_OUT": 2, "SKIPPED_NO_CONTACT": 0, "SKIPPED_QUOTA": 0, "SKIPPED_DISABLED": 0 },
  "heldCount": 0,                          // queued messages waiting for quiet hours to end
  "nextReleaseAt": null,                   // earliest held release time
  "pickedMemberIds": ["uuid"]              // PICKED mode only
}
```

### GET /communications/campaigns/:id/recipients  (notifications:view)
Query: `status?` (RecipientStatus), `channel?`, `search?` (member name/code), `page=1`, `limit=50` (max 200).
Response: `{ items:[{ id, memberId (uuid), memberCode, memberName, channel, status, error|null, sentAt|null, heldUntil|null }], page, limit, total, totalPages }`. `error` is a human sentence ("Phone number is not valid", "Member opted out of SMS promotions", "Monthly SMS quota used up", provider error text, ...). No contact values are returned.
For `SENT`: PUSH/IN_APP = accepted by our queue / written to the inbox; EMAIL/SMS/WHATSAPP = the provider call succeeded (delivery receipts are not tracked).

### PATCH /communications/campaigns/:id  (notifications:send)
Only `DRAFT` or `SCHEDULED` (409 `INVALID_STATE` otherwise, including if the minute scheduler started it meanwhile). Any subset of: `name,title,body,channels,audienceMode,audienceFilter,pickedMemberIds,templateKey,scheduledAt,holdQuietHours,confirmLargeSend`. Same validation as create; a SCHEDULED campaign is re-checked (audience, quota, confirm). Returns `CampaignDto`.

### POST /communications/campaigns/:id/send  (notifications:send)
Start a DRAFT now. Body `{ "confirmLargeSend": false }` (strict). Same checks as create NOW. Returns `CampaignDto` (status SENDING).

### POST /communications/campaigns/:id/cancel  (notifications:send)
`DRAFT | SCHEDULED | SENDING` -> `CANCELLED`; every not-yet-handed-over `QUEUED` message (including held ones) becomes `CANCELLED`; messages already handed to a channel queue still finish and are counted. Otherwise 409 `INVALID_STATE`. Returns `CampaignDto`.

### POST /communications/campaigns/:id/retry-failed  (notifications:send)
Campaign status `SENT | PARTIAL | FAILED` with at least one `FAILED` message: those go back to `QUEUED` (quota is checked again per message), campaign -> `SENDING`. Returns `{ retried: 2, campaign: CampaignDto }`. 409 `INVALID_STATE` when nothing failed / still sending / cancelled. Safe to call twice (the second call finds nothing to retry). Skipped (opted out, no contact, quota) messages are NOT retried.

### POST /communications/test-send  (notifications:send, 10/min per user)
Sends to the logged-in staff member's OWN contact only. Counts toward the gym's quota; email subject/SMS text are prefixed `[Test]`; written to the message log; not a campaign.
Request: `{ "title": "...", "body": "...", "channels": ["EMAIL","SMS","WHATSAPP","PUSH"] }` (placeholders validated and filled with sample data: Aarav / Kapoor / MEM-0001 / Monthly / 26 Oct 2026 / ₹1,500 / your gym name). `IN_APP` is not accepted (the member inbox is member-only).
Response: `{ "results": [ { "channel": "EMAIL", "status": "QUEUED"|"SKIPPED"|"FAILED", "message": "Queued to a***@x.com" } ] }` (masked destination, never the full value). `SKIPPED` reasons: no email/phone on the staff profile, no registered device, channel disabled, quota used up.

### GET /communications/automations  (notifications:view)
```jsonc
{
  "quietHours": { "start": "21:00", "end": "08:00", "channels": ["SMS","WHATSAPP"] },
  "items": [
    {
      "key": "MEMBERSHIP_EXPIRING", "label": "Membership expiring", "description": "...",
      "kind": "TRANSACTIONAL",             // TRANSACTIONAL = ignores promotional opt-out; PROMOTIONAL = respects it
      "timing": { "unit": "DAYS_BEFORE", "editable": true, "min": 1, "max": 60, "maxCount": 5, "defaultOffsets": [7,3,1] },
      "enabled": true, "isDefault": true,   // isDefault = no saved row, defaults apply
      "offsets": [7,3,1],
      "channels": ["PUSH","EMAIL"], "allowedChannels": ["PUSH","IN_APP","EMAIL","SMS","WHATSAPP"],
      "unavailableChannels": [ { "channel": "SMS", "reason": "disabled_platform" } ],   // selected channels the gym cannot send on right now (platform ceiling / gym toggle) - show a warning, saving is still allowed
      "title": null, "body": null,          // saved overrides (null = use default text)
      "defaultTitle": "...", "defaultBody": "...",
      "allowedPlaceholders": ["firstName","lastName","memberCode","planName","endDate","amountDue","gymName","daysLeft"],
      "sentLast7Days": 38, "lastSentAt": "..." | null, "updatedAt": "..." | null
    }
  ]
}
```
`timing.unit`: `DAYS_BEFORE`, `DAYS_AFTER`, `HOURS_BEFORE`, `DAYS_SINCE_VISIT`, `ON_DAY` (fixed, not editable), `EVENT` (fixed, not editable). Items are always the 9 rules in this order: MEMBERSHIP_EXPIRING, MEMBERSHIP_EXPIRED, PAYMENT_OVERDUE, INVOICE_DUE_SOON, PAYMENT_FAILED, CLASS_REMINDER, CLASS_SCHEDULED_OR_CHANGED, BIRTHDAY, WE_MISS_YOU. Defaults when no row exists:

| Rule | Timing | Channels | Default |
|---|---|---|---|
| MEMBERSHIP_EXPIRING | 7, 3, 1 days before the end date | PUSH, EMAIL | on |
| MEMBERSHIP_EXPIRED | 1 day after it ends | PUSH, EMAIL | on |
| PAYMENT_OVERDUE | 1, 7, 14 days after the due date | PUSH, SMS | on |
| INVOICE_DUE_SOON | 3 days before the due date | PUSH, EMAIL | on |
| PAYMENT_FAILED | next morning (1 day after) | PUSH | on |
| CLASS_REMINDER | 24 h and 2 h before a booked class | PUSH | on |
| CLASS_SCHEDULED_OR_CHANGED | event: class timetable changed / class cancelled / new class | PUSH, IN_APP | on |
| BIRTHDAY | on the day | PUSH, EMAIL | on |
| WE_MISS_YOU | 14 days since last visit | PUSH | **off** |

### PUT /communications/automations/:key  (notifications:manage, 30/10 min)
```jsonc
{ "enabled": true, "offsets": [7,3,1], "channels": ["PUSH","EMAIL"], "title": "..." | null, "body": "..." | null }
```
Strict. Rules: `offsets` required for editable-timing rules (ints within `timing.min..max`, unique, at most `maxCount`, stored sorted), must be omitted for fixed rules; `channels` unique and each in `allowedChannels`; `enabled:true` needs >=1 channel; `title`/`body` only use `allowedPlaceholders`; title <=200, body <=2000. `null` clears an override. Returns the updated rule item (same shape as above, `isDefault:false`). Unknown key -> 422. Audited as `communications.automation_updated`.

### POST /communications/automations/:key/test  (notifications:manage, 10/min)
Body `{}` (strict) or `{ "channels": [...] }` (subset of the rule's channels). Sends the rule's current message with sample data to the staff member's own contact, same behaviour/response as test-send. Audited as `communications.test_sent`.

### GET /portal/notification-preferences  (member token)
```jsonc
{
  "channels": [
    { "channel": "PUSH", "label": "Push notifications", "promotionalOptOut": false },
    { "channel": "EMAIL", "label": "Email", "promotionalOptOut": false },
    { "channel": "SMS", "label": "SMS", "promotionalOptOut": true },
    { "channel": "WHATSAPP", "label": "WhatsApp", "promotionalOptOut": false }
  ],
  "nonBlockable": [
    { "key": "MEMBERSHIP_REMINDERS", "label": "Membership expiry reminders" },
    { "key": "PAYMENT_REMINDERS", "label": "Invoice and payment reminders" },
    { "key": "CLASS_UPDATES", "label": "Reminders and changes for classes you booked" },
    { "key": "ACCOUNT_MESSAGES", "label": "Account, security and receipt messages" }
  ],
  "note": "Opting out stops promotional and general announcements on that channel. Reminders about your own membership, payments and bookings are always delivered."
}
```
### PUT /portal/notification-preferences  (member token, 30/15 min)
`{ "channels": [ { "channel": "SMS", "promotionalOptOut": true } ] }` (1..4 unique entries, channel in PUSH|EMAIL|SMS|WHATSAPP, strict). Upserts only the listed channels; returns the same body as GET. Member id comes from the token only. Audited as `member_portal.notification_preferences_updated`.

## What a member sees

- IN_APP / PUSH campaigns appear in `GET /portal/notifications` (category `GENERAL`, or the automation's category) and increase `unread-count`.
- Opted-out channels produce `SKIPPED_OPTED_OUT` recipient rows (campaigns only; automations of kind TRANSACTIONAL ignore opt-out).

## Known limitations (surface these in the UI copy)

1. **SMS and WhatsApp real delivery needs the platform's Kaleyra account + India DLT sender/template registration.** The API enqueues, gates and logs correctly; carrier delivery was not verified in development. Provider rejections show up as `FAILED` with the provider's text in `error`.
2. **WhatsApp**: free-text bulk messages are only delivered by WhatsApp inside the 24-hour window after the member last wrote to the gym's number; otherwise an approved template is required (not built). Such failures are recorded per recipient as `FAILED` with an explanatory error, never silently; campaigns with WHATSAPP include a `notices[]` line saying so.
3. Push `SENT` means "handed to Firebase"; email/SMS/WhatsApp `SENT` means the provider accepted it. Delivery/read receipts are not tracked.
4. Quota is consumed when a message is handed to its channel queue (same as every other send in the app); calendar-month UTC periods.
5. All campaigns respect promotional opt-out; there is no "urgent operational notice" bypass.

## Automations at runtime (what the rules actually do)

- Rules are read by the scheduler jobs (`membership-renewal-reminder`, `membership-expired-notification`, `payment-reminder`, `outstanding-payment-reminder`, `failed-payment-retry`, `birthday-wishes`, plus the new `class-reminders` every 15 min and `we-miss-you` daily). A gym with no saved row gets the defaults in the table above.
- "N days before" rules (expiring, invoice due soon) send the tightest timing that already applies - a membership first seen with 5 days left gets the "7" message once, then "3" and "1" as time passes, never three at once. "N days after" rules (expired, overdue, payment failed) send the most advanced timing reached and stop 14 days after the last timing (so switching a rule on never replays old history).
- A rule never double-sends: one ledger row per rule + member + subject (membership / invoice / payment / class session) + timing.
- Own-account reminders (expiring, expired, overdue, invoice due, payment failed, class reminder, class changed for booked members) IGNORE a member's promotional opt-out. Birthday, We-miss-you and the "new class" announcement respect it.
- `CLASS_SCHEDULED_OR_CHANGED` fires from the classes module: when a class timetable is changed or the class is deleted, members holding a BOOKED seat in an upcoming session of that class are told (edits within 10 minutes collapse into one message); the first time a class gets a timetable, ACTIVE members of the class's branch are told about the new class (capped at 2,000 members).
- Email reminders for invoices keep their detailed invoice layout; every other automation message is the plain notification email. If the gym had customised the older notification template for expiry / failed payment / birthday (Notifications -> Templates), that text is still used until staff saves a custom title/body on the rule, and a template switched off there keeps the rule off until the rule is saved explicitly.
- SMS in the defaults (overdue) only goes out where the platform enabled SMS for the gym and quota remains; otherwise a `SKIPPED_*` row is written to the Message Log. Real SMS / WhatsApp delivery requires the platform's Kaleyra credentials and India DLT registration (see limitations).

## Notes for the clients

- Permission changes: tokens issued before this feature shipped carry the old permission version; a user gets `notifications:send` on next login/refresh (the migration bumps their permission version; the effective-permission cache otherwise expires within 30 minutes or at the 6-hourly `cache-refresh` job).
- Use `GET /communications/audience/members` for the picker and `POST /communications/audience/preview` for the live count (debounce ~300 ms). Disable a channel button when `quota.enabled` is false; show the red "over limit" state when `quota.over` and the shortfall as `quota.shortBy`.
- For the confirm step: preview returns `largeSend` (> 100); send `confirmLargeSend: true` only after the user ticks the box. Keep one `Idempotency-Key` per "Send" press so a double-tap cannot send twice.
