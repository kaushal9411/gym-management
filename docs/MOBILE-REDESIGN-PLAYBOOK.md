# Mobile redesign playbook (portable)

How the FitCloud Flutter app was redesigned screen-by-screen to match the web app's features with a rich, colourful, animated UI — written so the **same flow can be repeated in another system's mobile app**. Everything here was learned in the FitCloud `apps/mobile` redesign (Members, Leads, Team & Access, Branches, Membership Plans, Attendance, Workout, Diet, Classes, Body Measurements, Payments, Income, Expenses, Billing).

Replace names/paths with your own project's equivalents; the **rules, workflow, widget kit and checklists** are what carry over.

---

## 1. The five golden rules (user requirements)

1. **Design change only. Web parity only.** Add to mobile only what already exists in the web app. No new workflows, no extras web lacks (switches, shortcuts, insights, local-only lists), even if an endpoint exists. Existing mobile behaviour stays as it is. If web has something with a real endpoint that mobile lacks, adding it is allowed (unless not feasible, e.g. no file-saving package → drop and document).
2. **Roles & permissions never change.** Same permission keys, same gating of screens/actions/menu tiles/tabs, same branch scoping, same endpoints. Audit it every time (see §7).
3. **Every list screen opens with the same fixed-height gradient header** (`ListHero`). All list headers must be exactly the same height.
4. **Delete the old files a redesign replaces** (pages, widgets, cubits, states, DI registrations, routes, tests, doc references). Verify with an unreferenced-file scan (§8).
5. **Verify with static checks + unit/widget tests only** (`flutter analyze`, `flutter test`). No builds/installs unless asked. Be honest in reports that nothing was seen on a device.

Also standing: mobile only renders **real backend data** — if a design element has no endpoint, drop it and leave a doc comment saying why.

---

## 2. Per-screen workflow (what each agent/dev does)

**Step 0 — web inventory (mandatory, before any code).** Read the web pages end to end and write down: every page, KPI, filter, sort, card field, action, dialog, form field + validation, chart, empty/error state, workflow step, and which permission key gates each action. Then read the existing mobile code and the backend validators/DTOs/route permissions. Output a table **web vs mobile today**.

**Step 1 — gating matrix.** grep `permission`, `hasPermission`, `featureFlag`, role/session checks and menu entries for the feature. Write the before-matrix. Preserve it 1:1.

**Step 2 — build** (see §4–§6): list → detail → add/edit → sub-flows, phone + tablet.

**Step 3 — tests.** Model-parsing tests (esp. decimal strings), widget tests per permission set, tablet widget tests (≈1500×1300), phone no-overflow test (≈360×740).

**Step 4 — cleanup.** Delete replaced files; format only changed files; fix lints.

**Step 5 — docs + final report.** Add a section to the mobile guide and a numbered entry to the project-state/prompt-history file. Final report = web inventory vs mobile (added because web has it / NOT added because web lacks it), files created/changed/deleted, gating matrix + proof, analyze/test results, API traps, risks to check on a device.

Run big areas in parallel with background agents (one per feature). Give every agent the same brief template (§10) and tell them which files are shared (edit additively, re-read before editing).

---

## 3. Visual language

**Palette** (accent per feature; success/danger/warning from the theme):

| Name | Hex |
|---|---|
| indigo | `0xFF6366F1` |
| violet | `0xFF8B5CF6` |
| teal | `0xFF14B8A6` |
| amber | `0xFFF59E0B` |
| rose | `0xFFFF5C7A` |
| green | `0xFF10B981` |
| fuchsia | `0xFFC026D3` |

- Gradients: indigo → violet → fuchsia for heroes/primary buttons; deep indigo `0xFF312E81` → `0xFF4338CA` → `0xFF7C3AED` → `0xFFC026D3` → `0xFFEC4899` for the animated hero background.
- Fonts: Bricolage Grotesque (display) + Hanken Grotesk (body) through `AppText.display/body/eyebrow`.
- Theme: dark by default, light supported. **Neutral colours are getters** that switch on a theme flag, so they can't be used in `const` expressions — never cache a neutral in a static/final.
- Role palettes: staff (coral→violet) vs member (lime→teal). Member-plane screens keep the member palette.

**Look:** rounded cards (radius ≈ 20–22), tinted gradient header bands on cards with a gradient icon chip, soft coloured shadows on primary buttons, count-up numbers, rings that fill, bars that grow, pop-in calendar days, shimmering primary CTAs, pulsing status dots, drawn-in sparklines. Icons on every field. Bottom sheets (`showModalBottomSheet`) for all "more detail".

---

## 4. Widget kit (build these once, reuse everywhere)

| Piece | Purpose |
|---|---|
| `MeshHeroBackground` | Animated gradient hero background with two drifting colour blobs. **Must always fill full width** (wrap child in `SizedBox(width: double.infinity)` + `StackFit.passthrough`) or it shrinks to content width on tablets. |
| `ListHero` + `ListHeroButton` + `ListHeroChip` | **The shared list header.** Fixed content height (`kListHeroHeight = 210`), button row on top, big title, subtitle, count chips pinned at the bottom. Params: `title, subtitle, leading, trailing[], chips[], topInset, side`. Pass `topInset = MediaQuery.padding.top` only when no parent SafeArea; `side = 18 + teamSideInset(context)` to align with the capped column. |
| `kListHeroBelowAppBar` | For screens whose hero sits under a transparent AppBar (hubs/follow-ups): use `minHeight` so they end on the same line as `ListHero`. |
| Animation primitives | `FadeUp`, `CountUp`, `GrowBar`, `AnimatedRing`, `PopIn`, `DrawnSparkline`, `Looping`, `SpinningRing`, `PulseDot`, `Floating`, `ShimmerButton`. Looping ones run forever — keep them off long lists. |
| `FormSection` / `*EditScaffold` | Gradient section card (icon chip + title + subtitle) for forms; page frame = transparent AppBar over a gradient banner (avatar/name/"Editing X") + sections + gradient Save button. Build a sibling scaffold for non-member entities. |
| `AppLabeledField(icon, iconColor, onChanged, readOnly, onTap, suffixIcon)` | Text field with a coloured icon chip; read-only+onTap turns it into a picker (dates). |
| `OptionPickerField` | Dropdown via bottom sheet; stores the **wire value**, shows the label (`List<(String value,String label)>`). |
| `_DateField` pattern | Small stateful read-only field owning its `TextEditingController`; never create controllers inside `build()`. |
| KPI tile grid + insight panel card | Tappable tiles → bottom sheet with ring/sparkline/list; panel cards with gradient header band + chevron. |
| Tablet helpers | `kTeamMaxWidth = 1280`, `kTeamWideBreak = 600`, `teamSideInset(context)`, `teamColumns(context)`, `TeamCenter` (caps width via symmetric padding so children still get tight constraints), `TeamAdaptive` (1→2 columns). |

---

## 5. Screen anatomy

**List screen:** `ListHero` (title, "N total · N shown", chips with live counts, add button gated by permission) → KPI tile grid (each opens a sheet) → insight panels (only if web has them) → search + filter/sort toolbar → status chips with counts → cards (rich or compact toggle) → load-more. Deleted items listed with a restore sheet where web lists them. Pull-to-refresh.

**Detail screen:** full-bleed `MeshHeroBackground` hero (transparent AppBar over it, content padded by `padding.top + kToolbarHeight`; title fades on scroll) → summary tiles (tappable → sheets) → tabs (Overview / … / Manage) → checklist-style cards (✓/✗ rows), icon field tiles, inline action buttons. Overlap the key-number card on the hero's bottom edge.

**Add/Edit:** banner + `FormSection`s with icon fields; chips for small enums, pickers for long enums, date pickers for dates; live summary/price card; completeness ring; multi-step wizard **only** if web's form is multi-step; edit sends **only changed keys**. Success → floating SnackBar → pop → previous screen reloads.

**Analytics screens (Payments/Income/Expenses):** period bar (Today / 7d / This month / Last month / 90d / Custom) + branch picker + Compare switch → KPI tiles with deltas → trend chart (Daily/Weekly/Cumulative, tap/drag inspect) → category donut → branch comparison → top-N → filters/search/sort → ledger cards with load-more.

**Tablet (≥ 600 dp):** content capped & centred (1280), multi-column cards/tiles/fields, heroes edge-to-edge, sheets & bottom bars capped ≈ 640. Phone layout must stay exactly as designed.

---

## 6. Hard-won technical lessons (these cost hours)

1. **Enums on the wire are UPPER_SNAKE** (`MALE`, `O_POSITIVE`). Never free text — pickers/chips with (value,label).
2. **Backend DECIMALs arrive as strings.** Parse `double.tryParse(json['x']?.toString() ?? '')`, never `as num`. A type error after a successful POST leaves spinners running forever and detail pages loading forever.
3. **Always add a generic `catch (e)`** next to `on ApiException` in submit flows and loaders; always reset loading flags; show the error with a retry.
4. **Show field-level server errors** via an `ApiException.detailedMessage` (`field: reason, …`) instead of "Request Validation Failed".
5. **Never `alignment: Alignment.center` on a Container in `Scaffold.bottomNavigationBar`** — it expands to full height and hides the page. Use `Center(heightFactor: 1)` or a Row with `mainAxisAlignment`.
6. Don't dispose a `TextEditingController` right after `showDialog` returns (red screen).
7. Don't create controllers inside `build()`.
8. **Query booleans like `isActive=false` / `includeDeleted=false` are coerced to `true` by `z.coerce.boolean()`** → only ever send `true`; load all and filter Inactive/Deleted on the device.
9. **Date ranges:** `<= new Date(dateTo)` drops the end day when you send a bare `YYYY-MM-DD` → send `T00:00:00.000Z` / `T23:59:59.999Z` for timestamp columns; send plain `YYYY-MM-DD` for `@db.Date` columns. Show date-only values without `toLocal`; show timestamps in local time.
10. Soft-deleted resources 404 on `GET /:id` → open a restore sheet built from list data instead.
11. PATCH rules differ per field (some nullable, some only optional) — read the validators; block clearing what can't be cleared; send only changed keys.
12. Body-size caps (e.g. 1 MB) can be lower than validator caps → cap uploads client-side.
13. Plan-gated modules return 403 "module unavailable" — keep graceful handling.
14. File editing: many files are CRLF — prefer the Edit tool; scripts must normalise `\r\n`→`\n` and restore; **literal replacements only** (a lazy `[\s\S]*?` regex once mangled a whole file). Heredocs with many quotes break Git Bash — write scripts to a scratch file. Python may not be installed; Node is.
15. **Format only the files you changed** (`dart format <files>`); formatting whole directories reformats unrelated files. The repo lints `require_trailing_commas` — fix and re-run analyze to zero.
16. Hot reload (`r`) doesn't re-run `initState`, `static/const` data, top-level lists or startup state; use hot restart (`R`). Run from the IDE debugger with `dart.hotReloadOnSave` to reload on save.
17. Widget tests: looping animations make `pumpAndSettle` hang — use fixed pumps; the default test font (Ahem) is much wider than real fonts, so also verify real 360 dp text on a device.

---

## 7. Roles & permissions audit (do after every redesign)

1. Diff permission keys vs the last commit:
   ```bash
   git grep -ho "'[a-z][a-z-]*:[a-z][a-z-]*'" HEAD -- lib | sort | uniq -c   # before
   grep -rho "'[a-z][a-z-]*:[a-z][a-z-]*'" lib --include=*.dart | sort | uniq -c  # after
   ```
2. Confirm every new key exists in the backend seed/registry and equals the route's `requirePermission`.
3. Diff menu/shell/router gating (`title/route/permissions/featureFlag`) against HEAD — only intentional additions allowed.
4. Add per-action hiding **only** where web gates the same action with the same key. Where the old mobile screen had no gating (server-only), keep it that way unless web gates it.
5. Add widget tests for several permission sets (none, view-only, role-typical, all keys) and a test that an ungated flow still shows everything with an empty permission set.

---

## 8. Cleanup checks

Unreferenced-file scan (run from the app root; prints Dart files nothing imports):

```js
// orph.js — node orph.js
const fs=require('fs'),path=require('path');
function walk(d,o=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);e.isDirectory()?walk(p,o):p.endsWith('.dart')&&o.push(p);}return o;}
const lib=walk('lib'),all=lib.concat(walk('test'));
const text=all.map(f=>fs.readFileSync(f,'utf8'));
for(const f of lib){const b=path.basename(f);if(b==='main.dart')continue;
 const re=new RegExp("['\"/]"+b.replace('.','\\.')+"['\"]");
 if(text.filter((t,i)=>all[i]!==f&&re.test(t)).length===0)console.log(f);}
```

Final gate for every change: `flutter analyze` (only known baseline warnings) → `flutter test` (all green) → orphan scan empty.

---

## 9. Order that worked

Members (list → detail → forms → wizard) → Leads → Team & Access → Branches → Membership Plans → Attendance → Workout → Diet → Classes → Body Measurements → Payments → Income → Expenses → Billing. Build the **shared kit first** (hero, list header, animation primitives, form scaffold, pickers, tablet helpers) on the first one or two features, then everything else reuses it.

---

## 10. Reusable agent brief (paste per feature, fill the blanks)

```
Task: REDESIGN the mobile app's <FEATURE> with ALL related pages (<list/detail/add/edit/sub-flows>).
Mobile only — do not touch web or API.

STEP 0 — web inventory first (mandatory): read the web <FEATURE> pages end to end and write a precise
inventory (pages, KPIs, filters, sorts, actions, dialogs, form fields+validation, empty/error states,
workflow). Then read the existing mobile code and backend validators. Put "web vs mobile today" in the report.

SCOPE (strict): design change only. Do NOT go beyond web and do NOT create new workflows/features.
Keep existing mobile behaviour as is. Drop anything with no endpoint (doc comment why).

CRITICAL: roles & permissions must NOT change — write the gating matrix first, preserve it 1:1,
add per-action hiding only where web uses the same key AND the key is in the backend seed AND equals
the route's requirePermission. Add tests per permission set. Keep routes and `extra` types working.

Design: reuse ListHero (all lists same height), MeshHeroBackground heroes, FormSection/edit scaffold,
AppLabeledField(icon), OptionPickerField, KPI tiles→bottom sheets, animation kit, tablet helpers
(content cap 1280, 2-col from 600). Palette: indigo/violet/teal/amber/rose/green/fuchsia.

Rules: enums UPPER_SNAKE via pickers; decimals are strings (tryParse); generic catch + reset loading;
detailedMessage for field errors; no Alignment.center in bottomNavigationBar; no controllers in build();
query booleans coerce false→true (filter on device); date-only vs timestamp handling; edit sends changed keys;
CRLF-safe literal edits; format only changed files; trailing commas; delete replaced files.

Shared files: additive Edit-tool changes only, re-read before editing; don't edit list_hero.dart.
Verify: ONLY flutter analyze + flutter test (no builds). Docs: section in the mobile guide + next free
numbered entry in the project-state file. Don't commit.

Final report: web inventory vs mobile (added because web has it / NOT added because web lacks it),
files created/changed/deleted, gating matrix + proof, analyze/test results, API traps, device risks.
```

---

## 11. Definition of done (per feature)

- [ ] Web inventory written; every web capability with an endpoint is on mobile; nothing beyond web was added.
- [ ] List uses `ListHero` (same height as other lists); detail/add/edit use the hero/banner + section cards.
- [ ] Phone (360) no-overflow test and tablet (1500×1300) test pass.
- [ ] Permission matrix identical (menus, shells, routes); per-action hiding only with web's key; tests added.
- [ ] Model parsing tolerant of decimal strings; generic catch + loading reset everywhere.
- [ ] Old files deleted; orphan scan empty; no dead imports/routes/DI.
- [ ] `flutter analyze` clean (baseline only) and `flutter test` green.
- [ ] Docs section + numbered history entry added.
- [ ] Final report lists what was **not** added because web lacks it, and what to check on a device.
