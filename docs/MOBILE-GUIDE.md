# Mobile Guide (`apps/mobile`)

Flutter 3.44 / Dart 3, Material 3, `flutter_bloc` (Cubits only — no Blocs), `get_it`, `go_router`, `dio`, `flutter_secure_storage`, `google_fonts`, `mobile_scanner`, `url_launcher`, `razorpay_flutter` (native Checkout modal, Prompt 62). Android-verified on a physical device; iOS never built or run.

**This is a from-scratch rebuild** (Prompts 53–57) against the approved "FitCloud Kinetic" HTML design at `/home/travoozy/Downloads/fitcloud-kinetic-design-v2.html`. It supersedes the Prompt 51/52 mobile app, which was scrapped. One binary serves five roles across two auth planes.

## The one rule that shaped every screen

**Only real backend APIs — never static or dummy data.** Where the design shows something the API can't back, the element is *dropped and the reason recorded in the screen's doc comment*, rather than faked. Every "why isn't X here?" question has its answer in the code. The complete list of drops is at the bottom of this guide; read it before assuming a screen is unfinished.

Corollary: when a design element looks unbacked, check the API first (`docs/BACKEND-GUIDE.md` + the module's validators) — Prompt 53 wrongly declared Branding/Invoice/2FA-policy "web console only" without checking, and Prompt 57 had to build all three because the endpoints existed the whole time.

## Layout

```
lib/
  main.dart                  setupServiceLocator() → BlocProvider<SessionCubit> → MaterialApp.router (dark theme only)
  core/
    config/env.dart          API_BASE_URL via --dart-define; defaults to 10.0.2.2:4000 (emulator→host)
    di/service_locator.dart  every repository + SessionCubit as lazy singletons; screen cubits as factories
    network/                 dio_client.dart, api_exception.dart, auth_event_bus.dart
    routing/                 app_routes.dart (path constants), app_router.dart (GoRouter + redirect), go_router_refresh_stream.dart
    storage/secure_storage.dart
    theme/                   app_colors.dart, app_text_styles.dart, app_radii.dart, app_theme.dart
  bloc/
    common/                  PaginatedListCubit<T> + PaginatedListState<T>  ← use this for new lists
    session/                 SessionCubit + SessionState (app-wide)
    branches|dashboard|finance/   three older feature cubits (pre-date the generic one)
  models/                    70+ files, one per DTO shape, hand-written fromJson (no codegen)
  repositories/              35 files, one per backend module, incl. body_measurement_repository.dart (Prompt 66, gained listMembers() in Prompt 67)
  features/<area>/presentation/   169+ screens, flat inside each feature, incl. catalog/{measured_members,new_measurement,member_measurements_detail}_screen.dart (Prompt 67)
  shared/widgets/            15 design-system widgets, incl. status_action_menu.dart + trainer_picker_field.dart (Prompt 63, made session-aware in Prompt 66 — see below) + measurement_form_fields.dart (Prompt 67, MeasurementFormController)
```

There is **no codegen** (no freezed/json_serializable/build_runner) and no `l10n`. Models are plain classes with a `factory X.fromJson`. Keep it that way — adding a build step now would touch every model.

## State rules (strict)

- **`SessionCubit` is the only app-wide *state* (rebuild-triggering).** Everything else is screen-scoped. There is no Redux-equivalent global store and no cross-screen cache — the one exception is `core/utils/app_currency.dart`'s `AppCurrency`, a static (not `ChangeNotifier`/Cubit) `{symbol, code}` read cache refreshed once per staff session and reset on sign-out (Prompt 79), deliberately plain statics rather than a new Cubit since nothing needs to rebuild when it changes — screens just read it fresh next time they format a number.
- **Server state lives in the screen that shows it.** Two accepted shapes, in order of preference:
  1. **`PaginatedListCubit<T>`** (`bloc/common/`) for anything backed by a `PaginatedResult` — construct it with a `(page) => repo.list(page: page, …)` closure, `..load()` it, and render with a `switch` over `PaginatedListLoading / PaginatedListError / PaginatedListLoaded`. ~15 screens use this; copy the nearest one.
  2. **Plain `StatefulWidget` fields** (`X? _data; bool _loading; String? _error;`) for detail screens, forms, and non-paginated GETs. Also the norm for anything with local edit state (steppers, toggles, pickers).
- `BranchListCubit`/`DashboardCubit`/`FinanceSummaryCubit` predate `PaginatedListCubit` and duplicate its shape. **Don't copy them for new work** and don't migrate them either (they're verified; churn without benefit).
- **No optimistic UI anywhere.** Mutations `await` the API and then `setState` from the *response*, so what you see is always what the server stored. Several device tests in Prompts 55–57 relied on this to prove writes round-tripped — keep it.
- **`IndexedStack` caches tabs.** Every role shell builds all its tabs at once, so a tab's `initState` runs on shell construction and **never re-runs on tab switch**. New data seeded server-side won't appear until pull-to-refresh or an app restart. This bites during testing constantly; it's not a bug.

## Auth: two planes, one binary

| | Staff plane | Member plane |
|---|---|---|
| Login | `POST /auth/login` (email + password, may return an OTP/MFA challenge) | `POST /member/auth/login` (**Member ID**, not email) |
| Refresh | `/auth/refresh` | `/member/auth/refresh` |
| API surface | the whole tenant API, permission-gated | **`/portal/*` only** |
| RBAC | `resource:action` permissions on the JWT | none — every route is hard-scoped to the caller's own id server-side |

- **Tenant first, always.** `FindGymScreen` resolves a slug via the public tenant endpoint before any login; the slug is persisted and `DioClient` attaches it as `X-Tenant-Slug` on **every** request. A request without it fails with `TENANT_NOT_FOUND`, not a 401.
- **`SecureStorage`** holds `tenant_slug`, `actor_type` (`staff|member`), `access_token`, `refresh_token`, and a cached `member_profile` JSON. `SessionCubit.restore()` reads `actor_type` to decide which plane to rehydrate.
- **`DioClient` auto-refreshes exactly one 401** per request, de-duped through a single `Completer` so concurrent 401s trigger one refresh. It picks the refresh path off the stored `actor_type`. If refresh fails it fires `AuthEventBus.onForcedLogout`, which `SessionCubit` listens to and turns into a sign-out — screens never handle this.
- Repositories therefore only ever see a normal response or a `DioException` → `ApiException`.

## Routing

- **All paths are constants in `core/routing/app_routes.dart`** — never a string literal at a call site.
- `app_router.dart` holds one flat `routes: []` (no nesting/ShellRoute) plus a `redirect` that pins signed-out users to the auth flow and signed-in users out of it. `GoRouterRefreshStream` re-runs that redirect whenever `SessionCubit` emits.
- **`/home` is the single authenticated entry point.** `HomeRouterScreen` branches to the right shell — `isOwner → OwnerShell`, `isManager → ManagerShell`, `isReceptionist → ReceptionistShell`, `isTrainer → TrainerShell`, member session → `MemberShell`, anything else → `SignedInStubScreen`. Adding a role means adding a branch here, not a route.
- **Arguments travel via `extra`**, typed and cast in the route builder (`state.extra as GymMember`). For more than one argument, declare a small `const class XArgs` **in the screen's own file** (see `WorkoutLogArgs`, `DayEditorArgs`, `MealBuilderArgs`) and pass that. There are no path params anywhere in the app.
- Pickers that return a value use `context.push<T>(...)` + `context.pop(value)` (e.g. `AddToMealScreen` returns `List<Food>`).

## Role shells

Each role gets its own `*Shell` — a `StatefulWidget` with an `IndexedStack` and a `GlassBottomNav`. Tab sets come from the design and are **not** interchangeable:

| Shell | Tabs |
|---|---|
| `OwnerShell` | Home · Members · Finance · Reports · Menu |
| `ManagerShell` | Home · Team · Members · Attendance · Menu |
| `ReceptionistShell` | Home · Members · Classes · Payments · Menu |
| `TrainerShell` | Home · Workouts · Diet · Menu — **4 tabs, the only one** |
| `MemberShell` | Home · Workout · Diet · Classes · Menu (member palette) |

**Screens are permission-gated, not role-locked**, so they're reused aggressively across shells: Manager's `MembersScreen`/`MemberDetailScreen`/Renew/Freeze/Upgrade are the Receptionist's Members tab verbatim; `RecordPaymentScreen` is the Receptionist's Payments tab; Support/Notifications/Reports-hub screens are shared by Owner, Manager, Receptionist and Trainer. Before building a screen for a new role, check whether one exists — usually it does, and reusing it unmodified is the established pattern.

Trainer's nav is worth internalising: **"Workouts" is the Exercise *library* and "Diet" is the Food *library*.** Workout/diet **plans** are not a top-level destination in the Trainer's own tabs — they're reached only through My Clients → Assign → Workout/Diet plan, a reduced-field create-only flow.

**Owner/Manager have a separate, full-CRUD entry point into the same plans** (Prompt 63): Menu → Programs → Workout Plans / Diet Plans / Classes, each a proper catalog (search, status filters, ⋯ menu for Duplicate/Activate-Deactivate/Delete/Restore) backed by `features/catalog/presentation/`. Both entry points call the **same repository** (`WorkoutPlanRepository`/`DietPlanRepository`/`GroupClassRepository`) — there is one create/update implementation, just two UI paths, matching how web itself lets you assign a plan either from the plan's own page or the member's page. Don't merge them; the user explicitly chose "coexist, share the repository layer" over unifying the flows.

## Design system (`core/theme/` + `shared/widgets/`)

- **Two palettes, one theme.** `AppColors` carries a staff ramp (coral `staffA` → violet `staffB`) and a member ramp (lime `memberA` → teal `memberB`), plus shared surfaces (`bg`, `surface`…`surface3`, `line`), ink (`ink`/`inkSoft`/`inkFaint`), semantic tones, and `glassFill`/`glassBorder`. The app is **dark-only** (`themeMode: ThemeMode.dark`).
- **`AppRole` (staff|member) selects the ramp** via extension getters — `role.gradient`, `role.a`, `role.soft`, `role.pillFg`, `role.onGradient`. Every shared widget takes `role` and defaults to `AppRole.staff`. **Member screens must pass `role: AppRole.member` explicitly** — a member screen in staff coral is the most likely visual regression.
- **`AppText`**: `display()` (Bricolage Grotesque, headings), `body()` (Hanken Grotesk), `eyebrow()` (11px/800/uppercase, the small label above a title), `tabular()` (figures). `display()`'s `color` is non-nullable — pass `AppColors.ink`, never `null`.
- **`AppRadii`**: `card 20`, `glass 22`, `field 14`, `button 12`, `pill 99`, `tile 11`, `bottomNav 22`. Also `screenH 18` / `screenTop 16` / `screenBottomWithNav 90` — that last one is the bottom padding every in-shell scroll view needs so content clears the floating nav.
- **Widgets**: `AppButton` (roleGradient|ghost × regular|small, `loading`), `AppPill` (success/warning/danger/roleTint/neutral), `AppCard`, `AppLabeledField`, `CategoryChipSelector<T>`, `GlassBottomNav`, `AppLoadingView`/`AppErrorView`/`AppEmptyState`/`FormAlert` (`app_state_views.dart`), `BrandMark`, `OtpInput`, `RoleToggle`.
- **Glass surfaces are hand-rolled per screen**, not a widget: a `Container` with a two-stop `LinearGradient` of translucent role colors + `AppColors.glassBorder`. Grep an existing one rather than inventing new alpha values.
- **Any tappable element — even a small inline "Edit" link inside a bigger non-interactive card — must be `Material` + `InkWell`, never a bare `GestureDetector`.** A bare `GestureDetector` nested inside a Row that also has plain `Text` siblings gets its semantics merged into one accessibility node covering the whole card, which makes `uiautomator`-driven device testing unable to locate a distinct, reliable tap target for it (discovered live in Chunk 7's `UserDetailScreen` section-edit links). It's very likely a real usability regression too, not just a testing inconvenience.
- Lints are strict (`strict-casts`/`strict-inference`/`strict-raw-types`, `require_trailing_commas`, `always_declare_return_types`, `prefer_final_locals`). **`flutter analyze` must be zero-warning** — the only permanent output is two `sort_pub_dependencies` infos in `pubspec.yaml`.

## Backend traps that cost real debugging time

- **`/attendance/*` is NOT branch-scoped server-side.** Unlike `/reports/*` and `/dashboard/*` (which auto-scope via `resolveBranchScope`), an attendance call that omits `branchId` returns the whole tenant. Manager's Attendance tab looks up its own `primaryBranch` with a `GET /staff/:id` self-lookup and passes it explicitly. Any new attendance screen must do the same.
- **`PATCH /workout-plans/:id/exercises` and `PATCH /diet-plans/:id/meals` replace the entire array.** The Day Editor re-sends every *other* day's exercises alongside the edited day; `WeeklyExerciseEditor`/`MealTypeEditor` (Prompt 63, the Owner/Manager catalog forms) follow the same rule. Send a delta and you'll silently wipe the rest of the plan. `PATCH /classes/:id/schedule` is the same convention a third time.
- **A diet plan meal's `quantity` comes back from the API as a string** (`"quantity": "2.5"`), not a number, same convention as every other Prisma `Decimal` field in this API (`Food.protein`/`carbohydrates`/`fat` etc.). Parse with `double.tryParse`, never cast.
- **Classes has no `activate`/`deactivate`/`duplicate` endpoints** — `GroupClass.isActive` is a plain field toggled via `PATCH /classes/:id`, and there is no `/classes/:id/duplicate` at all (`StatusActionMenu`'s `showActivateDeactivate`/`canDuplicate` flags both go `false` for Classes' ⋯ menu — same treatment as Exercises/Foods, which also lack activate/deactivate). Don't fabricate a client-side duplicate; confirmed absent via the route file, not assumed.
- **`PATCH /classes/:id` treats `trainerId` as tri-state**: omit it to leave unchanged, send a real id to set it, send `null` to explicitly clear it (`z.string().uuid().nullable().optional()`). The Owner/Manager catalog form always sends the full current state (including `trainerId: null` when no trainer is picked) rather than omitting the key, matching this codebase's "forms submit complete state" convention — verified live that an explicit `null` genuinely clears an already-set trainer rather than being ignored.
- **`GroupClassSession`s are never hand-created.** `GroupClass` (recurring template) → `GroupClassSchedule` slots (day+time, via `setSchedule`) → a nightly BullMQ job auto-generates dated, bookable `ClassSession` rows. `ClassSessionRepository.generate()` exists for a manual on-demand regeneration but has no UI trigger anywhere in the app — the nightly job is the real mechanism.
- **`POST /portal/diet/:id/log` merges** into the day's existing row (logging water can't wipe a logged meal) — the opposite convention to the two above. Verified live.
- **Member plane is `/portal/*` only** — confirmed by grep: no other module mounts `memberAuthenticateMiddleware`. There is no member-facing renew or payment route. `POST /portal/change-password` (Prompt 65) is the one write to the member's own account — every other profile field (name/email/phone/etc.) is still staff-managed only, no member-facing edit route for those.
- **`/support/tickets` is list/get/create only.** Replies come from FitCloud admins via the admin console, so a tenant has nothing to POST a reply to.
- **`GET /notifications` takes no category param** (only `unreadOnly`/paging), so the design's filter pills filter the fetched page client-side on each item's real `category`.
- **`GET /subscription` carries plan *limits* only**, no current usage — Billing's "Usage this cycle" numerators are the real `total`s from the branches/staff/members list endpoints.
- **Settings is four separate resources**: `/settings/profile` (+`/contact`, `/business-hours`), `/settings/branding`, `/settings/invoice`, `/settings/security`. `mfaRequiredRoles` is **load-bearing** — PATCHing `["OWNER"]` immediately forces that role's next login into the 2FA-setup screen. Don't toggle it on a test tenant without a TOTP app.
- **List endpoints cap `limit` at 100 tenant-wide** (`z.coerce.number().max(100)` — checked `/branches`, holds for `/users` too). A picker that requests `limit: 200` to "get everything" 422s outright, not just truncates. Always request ≤100 for an unpaginated picker list.
- **`POST /users/:id/{suspend,deactivate,restore}` and `DELETE /users/:id` all respond with `data: null`**, same shape as `POST /payments/:id/cancel` — the repository methods return `void` and the caller re-fetches. This is a recurring convention for action endpoints in this API: **don't assume an action endpoint echoes the updated entity — check the live response before writing the parser.**
- **`GET /roles` includes `SUPER_ADMIN`**, but every role-assignment endpoint (`POST /users`, `POST /invitations`, `PUT /users/:id/roles`) rejects it ("The SUPER_ADMIN role cannot be assigned here.") — verified live on all three. Any new role picker must filter it out, not just the obvious ones; it was missed on the first pass in `UserEditRolesScreen` and had to be added after `RoleFormScreen`/`InviteUserScreen` already had it.
- **`POST /payments/:id/cancel` responds with `data: null`**, while `POST /payments/:id/refund` returns the updated payment. Don't assume an action endpoint echoes its entity — `PaymentRepository.cancel` returns `void` and the screen re-fetches. Verified live.
- **`GET /billing/address` responds `data: null`** for a tenant with nothing saved yet — a real, common state (not every tenant sets this during onboarding), not an error. `BillingAddressScreen` renders an empty form rather than an error view when this happens.
- **`GET /search` is deliberately scoped to Members/Staff/Branches only** (not a full-app index) and each category is independently permission-filtered server-side — an empty section can mean either "no matches" or "you lack that category's view permission"; the client can't tell which and renders the same empty state either way, matching what the response actually communicates.
- **`POST /subscription`, `/subscription/upgrade`, `/subscription/downgrade` no longer activate the plan synchronously.** They return a discriminated result: `{requiresPayment: false, subscription, invoice, plan}` for a free/fully-discounted change (already activated), or `{requiresPayment: true, paymentId, orderId, amount, currency, keyId}` for anything with a balance due — a real Razorpay Order for the native Checkout modal (`razorpay_flutter`), not a Payment Link (a Payment Link approach was tried first and abandoned mid-Prompt-62 after an intermittent, never-fully-root-caused failure in `paymentLink.create()` against this dev machine's long-running API process — see PROJECT-STATE's dev-only caveats before reviving that approach). The plan does **not** change until `POST /subscription/checkout/:paymentId/verify` is called with the modal's signed `{razorpayOrderId, razorpayPaymentId, razorpaySignature}` success callback and the backend's local HMAC check passes — no polling, no webhook. `BillingRepository.checkout()` returns `CheckoutResult`; `CheckoutSheet` creates one `Razorpay()` instance in `initState`, listens for `EVENT_PAYMENT_SUCCESS`/`EVENT_PAYMENT_ERROR`, and calls `.open({key, amount, currency, order_id, ...})`. Don't assume a successful checkout call means the tenant's plan already changed.
- Response envelope is always `{success, message, data, errors}`; repositories unwrap `data` themselves. Paginated payloads are `{items, total, page, limit, totalPages}` → `PaginatedResult<T>`.

## Dev workflow

```bash
adb reverse tcp:4000 tcp:4000          # physical device → host API (re-run after any USB/wireless reconnect)
flutter build apk --debug --dart-define=API_BASE_URL=http://127.0.0.1:4000/api/v1
adb install -r build/app/outputs/flutter-apk/app-debug.apk
adb shell monkey -p com.fitcloud.gym_saas_mobile -c android.intent.category.LAUNCHER 1
```

Package id is **`com.fitcloud.gym_saas_mobile`** (not `com.fitcloud.mobile`).

**Verification standard** (per `CLAUDE.md`): `flutter analyze` clean **+** every new endpoint curl-tested against the running stack with a token for that actual role **+** an on-device pass. Static checks alone are not "done". Test credentials live in `docs/PROJECT-STATE.md`.

**Driving the device over adb** — screenshots proved unreliable; the accessibility tree is the signal:

```bash
adb shell uiautomator dump /sdcard/ui.xml
adb shell cat /sdcard/ui.xml   # parse content-desc + bounds → tap coordinates
```

`uiautomator dump` only sees widget text/bounds when Flutter's accessibility bridge is on (a screen reader running) — otherwise it returns a single opaque `FrameLayout` covering the whole screen (seen repeatedly in Prompt 62), so treat an empty dump as "tooling can't see in," not "screen is blank." **This device specifically also runs every app in Samsung DeX freeform windowing mode** (`dumpsys activity activities` shows `mode=freeform`), which stalls the Flutter engine's paint pipeline for freshly-pushed modal routes (bottom sheets, dialogs) in particular — `adb screencap` on a modal reliably comes back as a dimmed/content-less frame even though the modal is genuinely mounted and interactive; full-page routes (not modals) screencap fine. When you need to confirm a modal's actual content without trusting the screenshot: `flutter attach -d <device>` (prints a `Dart VM Service` URL), then a small Node script speaking the VM service's JSON-RPC-over-websocket protocol calling `ext.flutter.inspector.setPubRootDirectories` once and then `ext.flutter.inspector.getRootWidgetTree` (params `{isolateId, groupName, isSummaryTree: false, withPreviews: true}`) returns the built Element tree — including real widget text — independent of whether a frame has painted. (`ext.flutter.inspector.screenshot` and `flutter screenshot --type=skia` both throw `RenderBox was not laid out` in this same stalled state, so they don't help here.) This confirms code correctness but doesn't give you tap coordinates — for those, a human looking at the physical screen is more reliable than fighting the tooling further.

Physical-device quirks seen repeatedly across Prompts 54–57, all device-side, none app bugs: heavy touch-input lag (taps land seconds late, sometimes several screens on); synthetic taps on the bottom nav sometimes ignored while mid-screen taps work (workaround: temporarily set a shell's initial `_index`, build, verify, revert); `am start` silently ignored when another app holds focus (`am force-stop` the offender, then use `monkey`); USB dropping to wireless ADB mid-session (re-run `adb reverse`); Google autofill stealing the password field (retype it). Always `sleep` generously and dump before tapping.

## Testing

**There are no mobile tests.** `apps/mobile/test/` is empty despite `bloc_test` + `mocktail` sitting in dev_dependencies. Everything has been verified by analyze + curl + device only. `PaginatedListCubit`, `SessionCubit` (restore/forced-logout), and the `DioClient` refresh interceptor are the obvious first targets.

## Design fidelity: what's deliberately missing

Each item is dropped because **no API backs it**, and each is documented in the relevant screen's doc comment. Don't "fix" these without adding a backend first.

| Design frame | Dropped | Why |
|---|---|---|
| Member 4a — Renew (+ dashboard CTA) | whole flow | No member-facing renew/payment route exists anywhere. Renewals are staff-initiated; the card states the real expiry instead. |
| Member 5a — Log set | whole screen | The API stores a per-exercise *status*, never reps/weight/a logged set. |
| Member 6a — Log meal | food picker | Portal has no food endpoints; a meal is one status per meal type, not a food list. |
| Member 8f — Data export | "we'll email a link in 24h" copy | `GET /portal/gdpr-export` returns the bundle inline; no email, no queue. Screen reports the real section counts. |
| Trainer 5/9a | "4×10 · 60kg" detail, "@ 62kg" load | Portal exercise DTO has no sets/reps; no weight field exists at all. |
| Trainer 9 | "On track" pill | Shows the assignment's real status rather than a judgement the API doesn't make. |
| Owner 11b | "Upload logo" | No image-picker package; endpoint needs a base64 data URL. |
| Owner 11a | "Operating hours" single field | API models hours per weekday; flattening would overwrite real values. |
| Owner 11d | "Session timeout" | `/settings/security` stores only `mfaRequiredRoles`. |
| Owner 12a | reply composer | `/support/tickets` is list/get/create only. |
| Manager 4a/4b | Leave request, Refund request | No `StaffLeave` model, no pending-refund-request entity. |
| Manager 5b | Trainer "Performance" card | No cross-reference to workout/diet assignment data built. |
| Receptionist 8 / Member 8d | "Download PDF" | No file-saving package (`path_provider`/`share_plus`) — the bytes would have nowhere to go. |
| Receptionist 9a | "Cancel session" | Only per-booking cancel exists, not cancel-the-whole-session. |
| Trainer 10 / Receptionist 10 | Workouts + Diet report tiles | No workouts/diet report screen exists anywhere in the app. |

**Every design frame that any endpoint backs is now built.**

**AI Assistant is explicitly out of scope** for mobile (user direction — "no need AI assistant on mobile"), not a missing-backend drop; the `ai:use` permission still appears in the Permissions registry tab (it mirrors web's registry verbatim) but no chat UI exists or is planned.

Six screens intentionally have **no** design frame of their own and exist as minimal glue: the Trainer's workout/diet **plan picker** lists (the design jumps straight from "Assign plan" to an already-open plan), the plan **create** forms, the **Payments list** (`PaymentsScreen`) — frame 14 "Payment detail" is drawn with no navigation source, so the list was added beside Income/Expenses in the Menu's Finance section to reach it — and, from the mobile-vs-web feature audit (Chunk 8, no Kinetic frame exists for either): **Global Search** (`GlobalSearchScreen`, reached via a "Global Search" Menu tile on Owner/Manager) and **Billing Address** (`BillingAddressScreen`, reached via a button on the Billing screen beside "View billing history").

Same reasoning applies to the whole Owner/Manager plan-library catalog added in Prompt 63 (`features/catalog/presentation/`) — no Kinetic frame covers "the plan library as its own admin screen" (web has this surface, the mockup never did): `workout_plan_form_screen.dart`'s `WorkoutPlanCatalogFormScreen`, `diet_plan_form_screen.dart`'s `DietPlanCatalogFormScreen`, and `classes_screen.dart` were all built senior-UX-judgement-first from web's equivalent pages, following this app's own established CRUD template (`membership_plan_form_screen.dart`) rather than any HTML mockup.
