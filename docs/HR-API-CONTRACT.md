# HR Management — API contract (`apps/api`, module `modules/hr/`)

> **Source of truth for the web (Next.js) and mobile (Flutter) HR screens.** Written BEFORE the implementation; if the implementation deviates, this file is updated immediately (check the "Changelog" at the bottom). Same content is folded into `docs/BACKEND-GUIDE.md` ("HR module").
> Prompt 182. Base URL `/api/v1`, all routes under `/hr`. Auth = the normal staff Bearer JWT + `X-Tenant-Slug`/subdomain (same as every tenant route).

## 0. Conventions

- **Envelope** (all responses): `{ "success": true, "message": "OK", "data": <payload>, "errors": null, "timestamp": "...", "requestId": "..." }`. Errors: `success:false`, `data:null`, `errors:[{ "code": "LEAVE_OVERLAP", "message": "...", "field"?: "startDate" }]`. Validation failures = HTTP 422 `VALIDATION_ERROR` with one `errors[]` entry per field.
- **Dates** `"YYYY-MM-DD"` = IST (Asia/Kolkata) business dates. **Months** `"YYYY-MM"`. **Times of day** `"HH:mm"` (24 h, IST). **Timestamps** ISO-8601 UTC (`"2026-11-22T03:30:00.000Z"`). **Money** = JSON numbers in rupees with 2 decimals (e.g. `18000`, `1500.5`) — NOT strings (differs from `/expenses`). **Day counts** = numbers with at most one decimal (`0.5`, `2`, `3.5`).
- **Ids** are UUID strings. All lists that say "paginated" return `{ items, total, page, limit, totalPages }` (`page` default 1, `limit` default 20, max 100; employees list max 200).
- **Who is an "employee"**: an active (non-deleted) `User` that has a `StaffProfile` (everyone created through Staff Management: MANAGER / TRAINER / RECEPTIONIST). The OWNER is an employee **only if** a StaffProfile exists for them (today the owner has none → owner can use all HR/admin endpoints but not `/hr/me/*`, which return 403 `NOT_AN_EMPLOYEE`). Terminated staff (`workStatus = TERMINATED`) and soft-deleted users are excluded from lists/payroll.
- **`/hr/me/*`** is ALWAYS scoped to the caller (`req.auth.sub`); no endpoint under it accepts a `userId`.
- Everything is tenant-scoped (RLS). Every mutation writes an audit-log row (`hr.*` actions, see §12).

### Enums

| Enum | Values |
|---|---|
| `DayPart` | `FULL_DAY`, `HALF_DAY_MORNING`, `HALF_DAY_EVENING` |
| `LeaveStatus` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `AttendanceStatus` (stored) | `PRESENT`, `ABSENT`, `HALF_DAY`, `LATE`, `ON_LEAVE`, `WEEKLY_OFF`, `HOLIDAY` |
| `DayStatus` (what read endpoints return) | `AttendanceStatus` ∪ `NOT_MARKED` (today/future, nothing recorded) ∪ `NOT_JOINED` (before the employee's joining date) |
| `AttendanceSource` | `SELF` (employee check-in/out), `MANUAL` (HR marked/edited), `SYSTEM` (written by leave approval) |
| `PayComponentType` | `ALLOWANCE`, `DEDUCTION` |
| `PayrollRunStatus` | `DRAFT` → `APPROVED` → `PAID` |
| `PayslipStatus` | `DRAFT` → `PAID` |
| `PayslipLineSource` | `STRUCTURE` (from the employee pay structure), `MANUAL` (added on the payslip) |
| `PaymentMode` | `CASH`, `UPI`, `BANK_TRANSFER`, `CHEQUE`, `OTHER` |
| `Weekday` | `MONDAY` … `SUNDAY` (upper-case) |
| `HrNotificationType` | `LEAVE_APPLIED`, `LEAVE_APPROVED`, `LEAVE_REJECTED`, `LEAVE_CANCELLED`, `PAYSLIP_PAID` |

## 1. Permissions

| Key | Meaning | Default grants |
|---|---|---|
| `hr:view` | Read HR overview, employees, all-staff attendance, leave types/holidays/shifts/policy | OWNER, MANAGER |
| `hr:attendance_manage` | Mark / edit / clear anyone's attendance (needs reason) | OWNER, MANAGER |
| `hr:leave_manage` | See all leave requests, approve/reject/cancel, apply on behalf, leave types, holidays, balance adjust | OWNER, MANAGER |
| `hr:payroll_manage` | Pay structure, payroll runs, payslips, mark paid, see salary | OWNER only (MANAGER does not get it by default; assignable via roles/user overrides) |
| `hr:settings_manage` | Shifts (CRUD + assign) and HR policy | OWNER, MANAGER |
| `hr:self_attendance` | Own check-in/out, own attendance, own summary/holidays | OWNER, MANAGER, TRAINER, RECEPTIONIST |
| `hr:self_leave` | Own leave requests, balances, leave types list, own HR notifications | OWNER, MANAGER, TRAINER, RECEPTIONIST |
| `hr:self_payslip` | Own payslips (+PDF) | OWNER, MANAGER, TRAINER, RECEPTIONIST |

- The `hr:*` management keys assume `hr:view` as the base (the UI should hide the HR area unless the user has `hr:view`, or any `hr:self_*` for the "My HR" self-service area).
- Custom (tenant-created) roles get none of these by default; they appear in the role editor like any key.
- Salary visibility: `GET /hr/employees` never returns salary. `GET /hr/employees/:userId` returns `payStructure` and `payslips` only when the caller also has `hr:payroll_manage` (otherwise `payStructure: null`, `payslips: []`).
- A user can never approve/reject/auto-approve **their own** leave request → 403 `FORBIDDEN` ("You cannot decide your own leave request.").

## 2. Shared shapes

```jsonc
// EmployeeRef
{ "userId": "uuid", "employeeId": "EMP-0002", "name": "Vikram Coach", "avatarUrl": null, "role": "TRAINER" }

// ShiftRef
{ "id": "uuid", "name": "General", "startTime": "06:00", "endTime": "21:00", "graceMinutes": 10 }

// LeaveTypeRef
{ "id": "uuid", "name": "Casual Leave", "code": "CASUAL", "color": "#6366f1", "isPaid": true }

// AttendanceDay — one calendar day for one employee (computed when no row exists)
{
  "date": "2026-11-22",
  "userId": "uuid",
  "status": "PRESENT",                // DayStatus
  "recorded": true,                   // false => computed (ABSENT/WEEKLY_OFF/HOLIDAY/NOT_MARKED/NOT_JOINED) – no DB row
  "id": "uuid|null",
  "checkInAt": "2026-11-22T00:35:00.000Z|null", "checkOutAt": null,
  "checkInTime": "06:05|null", "checkOutTime": null,      // IST HH:mm of the above
  "workedMinutes": null,              // int, only when both check-in and check-out exist
  "lateMinutes": 0, "overtimeMinutes": 0,
  "source": "SELF|MANUAL|SYSTEM|null",
  "remark": "string|null",            // always present for MANUAL rows
  "markedBy": { "id": "uuid", "name": "Kaushal Chauhan" },   // null for SELF / computed rows
  "leaveRequestId": "uuid|null", "leaveType": { LeaveTypeRef } /* or null */, "leaveDayPart": "DayPart|null",
  "holidayName": "Diwali|null",
  "shift": { "name": "General", "startTime": "06:00", "endTime": "21:00" }   // shift snapshot for the day, null if none
}

// AttendanceStats
{ "present": 18, "late": 2, "halfDay": 1, "onLeave": 2, "absent": 0, "weeklyOff": 4, "holiday": 1, "notMarked": 3,
  "workedMinutes": 9120, "lateCount": 2, "overtimeMinutes": 0 }
// (counts are in DAYS: a half day counts 1 in `halfDay`; `present` excludes late/half-day rows)

// LeaveRequest
{
  "id": "uuid",
  "employee": { EmployeeRef },
  "leaveType": { LeaveTypeRef },
  "startDate": "2026-11-25", "endDate": "2026-11-26",
  "dayPart": "FULL_DAY",
  "days": 2,                           // working days only (weekly offs & holidays excluded; half day = 0.5)
  "reason": "Family function",
  "status": "PENDING",
  "appliedOnBehalf": false,            // true when HR applied for the employee
  "appliedBy": { "id": "uuid", "name": "..." } ,   // who created it (the employee themself unless appliedOnBehalf)
  "createdAt": "ISO",
  "decidedBy": { "id": "uuid", "name": "..." } | null,
  "decidedAt": "ISO|null",
  "decisionRemark": "string|null",
  "cancelledAt": "ISO|null",
  "canCancel": true                    // only meaningful on /hr/me/leaves*: PENDING, or APPROVED with startDate > today
}

// LeaveBalance (one per active leave type)
{
  "leaveType": { LeaveTypeRef },
  "leaveYear": 2026, "leaveYearLabel": "2026-27", "periodStart": "2026-04-01", "periodEnd": "2027-03-31",
  "quota": 12, "carriedForward": 0, "adjustment": 0,
  "entitled": 12,                      // quota + carriedForward + adjustment ; null when type is unlimited
  "used": 1.5,                         // sum of APPROVED request days in this leave year
  "pending": 2,                        // sum of PENDING request days (reserved)
  "available": 8.5                     // entitled - used - pending ; null when unlimited
}
// unlimited type (yearlyQuota null, e.g. Unpaid): quota/entitled/available = null, used/pending still counted.

// Holiday
{ "id": "uuid", "date": "2026-12-25", "name": "Christmas", "description": null, "branch": null }   // branch: {id,name} or null (all branches)

// LeaveType
{ "id": "uuid", "name": "Casual Leave", "code": "CASUAL", "yearlyQuota": 12 /* null = unlimited */, "isPaid": true,
  "carryForward": false, "carryForwardMax": null, "color": "#6366f1", "isActive": true, "sortOrder": 1 }

// Shift
{ "id": "uuid", "name": "General", "startTime": "06:00", "endTime": "21:00", "graceMinutes": 10,
  "weeklyOffDays": ["SUNDAY"], "isDefault": true, "isActive": true, "employeeCount": 3 }

// Policy
{
  "leaveYearStartMonth": 4,            // 1..12 (4 = 1 Apr – 31 Mar)
  "defaultWeeklyOff": ["SUNDAY"],      // used when neither the employee nor their shift defines weekly offs
  "lateGraceMinutes": 10,              // default grace pre-filled for NEW shifts (lateness is always judged against the employee's shift grace)
  "halfDayThresholdHours": 4,          // checked-out day with worked time < this => HALF_DAY
  "standardDayHours": 8,               // overtime / hourly-rate basis
  "latePenaltyEnabled": false, "latePenaltyLatesPerUnit": 3, "latePenaltyDays": 0.5,
  "overtimeEnabled": false, "overtimeMultiplier": 1.5,
  "backdateLeaveDays": 30,             // employees may apply leave starting up to N days in the past
  "workingDaysBasis": "CALENDAR_MINUS_WEEKLY_OFFS"   // read-only constant
}

// PayComponent / PayStructure
{ "userId": "uuid", "salaryType": "MONTHLY", "baseSalary": 18000 /* null if not set */,
  "components": [ { "id": "uuid", "name": "Travel allowance", "type": "ALLOWANCE", "amount": 1500, "isActive": true } ],
  "monthlyGross": 19500,               // base + active ALLOWANCEs
  "fixedDeductions": 500 }             // active DEDUCTIONs

// PayslipLine
{ "id": "uuid", "name": "Travel allowance", "type": "ALLOWANCE", "amount": 1500, "source": "STRUCTURE" }

// Payslip (full) — see §9 for the formula
{
  "id": "uuid", "runId": "uuid", "month": "2026-11", "status": "DRAFT",
  "employee": { EmployeeRef }, "salaryType": "MONTHLY",
  "workingDays": 26, "presentDays": 21, "halfDays": 1, "paidLeaveDays": 2, "unpaidLeaveDays": 0,
  "absentDays": 1, "holidayDays": 1, "weeklyOffDays": 4, "notEmployedDays": 0,
  "lateCount": 2, "overtimeMinutes": 0,
  "unpaidDays": 1.5,                   // absent + half-day losses + unpaid leave + notEmployed
  "dailyRate": 750,
  "baseSalary": 18000, "fixedAllowances": 1500, "monthlyGross": 19500,
  "attendanceDeduction": 1125, "overtimePay": 0,
  "extraAllowances": 0, "bonus": 0, "grossEarnings": 18375,
  "fixedDeductions": 500, "extraDeductions": 0, "latePenalty": 0, "advanceRecovery": 0, "totalDeductions": 500,
  "netPay": 17875,
  "lines": [ { PayslipLine } ],
  "notes": ["Base salary not set; payslip base is 0."],    // generation warnings, may be []
  "paidAt": "ISO|null", "paymentMode": "UPI|null", "paidOn": "2026-12-01|null",
  "paidBy": { "id": "uuid", "name": "..." } | null, "paidRemark": "string|null",
  "expenseId": "uuid|null",
  "createdAt": "ISO", "updatedAt": "ISO"
}
// PayslipSummary = the same object WITHOUT workingDays..lines (keeps: id, runId, month, status, employee, netPay, grossEarnings, totalDeductions, paidAt, paymentMode)

// PayrollRun
{ "id": "uuid", "month": "2026-11", "status": "DRAFT",
  "employeeCount": 4, "totalGross": 80000, "totalDeductions": 2000, "totalNet": 78000,
  "paidCount": 0, "paidAmount": 0, "notes": null,
  "createdBy": { "id": "uuid", "name": "..." }, "createdAt": "ISO",
  "approvedBy": { "id": "uuid", "name": "..." } | null, "approvedAt": "ISO|null", "paidAt": "ISO|null" }
```

## 3. Self-service — `/hr/me/*` (caller's own data only)

All return 403 `NOT_AN_EMPLOYEE` when the caller has no StaffProfile.

### `GET /hr/me/summary` — `hr:self_attendance`
```jsonc
{
  "employee": { EmployeeRef, "joiningDate": "2026-11-21", "shift": { ShiftRef } | null, "weeklyOff": ["SUNDAY"] },
  "today": {
    "date": "2026-11-22",
    "attendance": { AttendanceDay },
    "isWeeklyOff": true, "holidayName": null,
    "canCheckIn": false, "canCheckOut": false          // exactly what the check-in/out buttons should allow
  },
  "month": { "month": "2026-11", "stats": { AttendanceStats } },
  "leaveBalances": [ { LeaveBalance } ],               // current leave year, active types
  "pendingLeaves": [ { LeaveRequest } ],
  "upcomingLeaves": [ { LeaveRequest } ],              // APPROVED, endDate >= today, max 5
  "upcomingHolidays": [ { Holiday } ],                 // next 60 days, applicable to the employee's branches
  "latestPayslip": { PayslipSummary } | null,          // newest APPROVED/PAID payslip
  "unreadNotifications": 2
}
```

### `POST /hr/me/attendance/check-in` — `hr:self_attendance` — body `{}` (optional `{ "note": "string ≤200" }` stored as remark)
Creates today's row with `checkInAt = now`, `source = SELF`, `status = LATE` if check-in is later than shift start + grace (else `PRESENT`; employees without an assigned shift use the tenant default shift; with no shift at all nobody is ever late), `lateMinutes` = minutes after shift start + shift grace (see §9). → **201** `AttendanceDay`.
Errors: 409 `ALREADY_CHECKED_IN`; 409 `INVALID_STATE` if today is a full-day approved leave ("You are on approved leave today") or HR already marked today ("Attendance for today was already marked by HR"). Working on a weekly off / holiday is allowed (status PRESENT/LATE).

### `POST /hr/me/attendance/check-out` — `hr:self_attendance` — body `{}`
Sets `checkOutAt = now`, `workedMinutes`, recomputes status (`worked < halfDayThresholdHours*60` ⇒ `HALF_DAY`; else `LATE` if it was late else `PRESENT`) and `overtimeMinutes` (only when policy.overtimeEnabled is irrelevant here — always stored: minutes beyond `standardDayHours`). → 200 `AttendanceDay`.
Errors: 409 `NOT_CHECKED_IN`, 409 `ALREADY_CHECKED_OUT`.

### `GET /hr/me/attendance?month=YYYY-MM` — `hr:self_attendance` (month default = current IST month; may not be after the current month)
```jsonc
{ "month": "2026-11", "days": [ { AttendanceDay } /* one per calendar day, 1st..last */ ], "stats": { AttendanceStats } }
```

### `GET /hr/me/leave-types` — `hr:self_leave` → `[ LeaveType ]` (active only, sorted by `sortOrder`)
### `GET /hr/me/leave-balances?leaveYear=2026` — `hr:self_leave` → `{ "leaveYear": 2026, "leaveYearLabel": "2026-27", "periodStart": "...", "periodEnd": "...", "balances": [ LeaveBalance ] }` (leaveYear default = current)
### `GET /hr/me/holidays?year=2026` — `hr:self_leave` → `[ Holiday ]` (year default current; applicable to the employee's branches)

### `POST /hr/me/leaves/preview` — `hr:self_leave`
Body `{ "leaveTypeId": "uuid", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "dayPart": "FULL_DAY" }` (dayPart optional, default FULL_DAY). Runs the same validation as apply but writes nothing.
```jsonc
{ "days": 2, "excluded": [ { "date": "2026-11-29", "reason": "WEEKLY_OFF" }, { "date": "2026-12-25", "reason": "HOLIDAY", "name": "Christmas" } ],
  "available": 8.5, "sufficient": true }   // available null when unlimited
```
Same errors as apply.

### `GET /hr/me/leaves?status=&page=&limit=` — `hr:self_leave` → paginated `LeaveRequest` (newest `createdAt` first; `canCancel` populated)
### `GET /hr/me/leaves/:id` — `hr:self_leave` → `LeaveRequest` (404 if not the caller's)
### `POST /hr/me/leaves` — `hr:self_leave` — apply
Body: `{ "leaveTypeId": "uuid", "startDate": "2026-11-25", "endDate": "2026-11-26", "dayPart": "FULL_DAY", "reason": "Family function" }` — `reason` required, 3–500 chars; `endDate` defaults to `startDate`. → **201** `LeaveRequest` (`status: "PENDING"`). Notifies every user holding `hr:leave_manage` (in-app + push).
Rules / errors (all 422 `VALIDATION_ERROR` unless noted):
- `endDate < startDate`; range > 120 days; half-day (`dayPart != FULL_DAY`) with `startDate != endDate`.
- `startDate` before the employee's joining date; `startDate` earlier than `today - policy.backdateLeaveDays` (employees only; HR on-behalf has no back-date limit); start/end in different leave years ("Apply separately for each leave year"); `startDate` more than 366 days ahead; inactive/unknown leave type (404 `NOT_FOUND`).
- 422 `NO_WORKING_DAYS` — the range contains only weekly offs / holidays.
- 409 `LEAVE_OVERLAP` — overlaps a PENDING/APPROVED request of the same employee (two half-days of the *opposite* parts on the same date do not overlap; morning+morning, or anything with a full day, does).
- 422 `INSUFFICIENT_LEAVE_BALANCE` — type has a quota and `days > available`.
### `POST /hr/me/leaves/:id/cancel` — `hr:self_leave` — body `{ "remark"?: "string ≤300" }` → `LeaveRequest` (`CANCELLED`)
Allowed: own PENDING; own APPROVED with `startDate > today`. Else 409 `INVALID_STATE`. On cancelling an APPROVED leave the SYSTEM attendance rows it created are deleted (balance restores automatically because `used` is derived). Approvers are notified (`LEAVE_CANCELLED`).

### `GET /hr/me/payslips?page=&limit=` — `hr:self_payslip` → paginated `PayslipSummary` (only payslips whose run is `APPROVED` or `PAID`; DRAFT runs are invisible to employees)
### `GET /hr/me/payslips/:id` — `hr:self_payslip` → `Payslip`
### `GET /hr/me/payslips/:id/pdf` — `hr:self_payslip` → `application/pdf` (inline)

### `GET /hr/me/notifications?unreadOnly=&page=&limit=` — `hr:self_leave`
```jsonc
{ "items": [ { "id": "uuid", "type": "LEAVE_APPROVED", "title": "Leave approved", "body": "Your casual leave 25–26 Nov was approved. Remark: Enjoy", "entityType": "leave_request", "entityId": "uuid", "readAt": null, "createdAt": "ISO" } ],
  "unreadCount": 2, "total": 7, "page": 1, "limit": 20, "totalPages": 1 }
```
### `POST /hr/me/notifications/read-all` · `POST /hr/me/notifications/:id/read` — `hr:self_leave` → `null` data, 200.

Push (FCM, staff devices of the target user): `data = { "type": "hr", "hrType": "<HrNotificationType>", "entityType": "...", "entityId": "uuid" }`.

## 4. HR overview & employees (`hr:view`)

### `GET /hr/overview` — `hr:view`
```jsonc
{
  "date": "2026-11-22",
  "headcount": 4,
  "today": { "present": 1, "late": 1, "halfDay": 0, "onLeave": 1, "absent": 0, "weeklyOff": 0, "holiday": 0, "notMarked": 1,
             "checkedInNow": 2 },              // buckets are mutually exclusive and sum to headcount; "absent" is only ever > 0 for past days (never for today)
  "pendingLeaves": 3,
  "payroll": { "month": "2026-11", "runId": "uuid|null", "status": "NOT_GENERATED|DRAFT|APPROVED|PAID", "totalNet": 78000, "unpaidPayslips": 4 },   // totalNet/unpaidPayslips null when NOT_GENERATED; hidden (payroll: null) without hr:payroll_manage
  "upcomingLeaves": [ { "id": "uuid", "employee": { EmployeeRef }, "leaveType": { LeaveTypeRef }, "startDate": "...", "endDate": "...", "dayPart": "FULL_DAY", "days": 2 } ],   // APPROVED, overlapping the next 14 days; [] without hr:leave_manage
  "trend": [ { "date": "2026-11-16", "present": 3, "late": 1, "halfDay": 0, "onLeave": 0, "absent": 0 } ],   // last 7 days incl. today, oldest first (absent computed for past days)
  "upcomingHolidays": [ { Holiday } ]            // next 30 days
}
```
### `GET /hr/employees?search=&status=&branchId=&page=&limit=` — `hr:view`
`status` = `accountStatus` filter (`ACTIVE`…); search matches name/email/employeeId. Paginated:
```jsonc
{ "userId": "uuid", "employeeId": "EMP-0002", "name": "...", "email": "...", "phone": "...|null", "avatarUrl": null,
  "role": "TRAINER", "accountStatus": "ACTIVE", "workStatus": "WORKING", "employmentType": "FULL_TIME", "joiningDate": "2026-11-21",
  "branches": [ { "id": "uuid", "name": "Main" } ],
  "shift": { ShiftRef } | null,               // effective shift (assigned, else tenant default)
  "weeklyOff": ["SUNDAY"],                    // effective
  "today": { "status": "PRESENT", "checkInTime": "06:05|null", "checkOutTime": null },
  "leaveBalances": [ { "leaveTypeId": "uuid", "code": "CASUAL", "name": "Casual Leave", "available": 9.5 } ],
  "pendingLeaves": 1 }
```
### `GET /hr/employees/:userId?month=YYYY-MM` — `hr:view`
```jsonc
{ "employee": { /* same as list item */ },
  "attendance": { "month": "2026-11", "days": [ AttendanceDay ], "stats": { AttendanceStats } },
  "leaves": [ LeaveRequest ],                 // latest 50; [] unless caller has hr:leave_manage
  "balances": [ LeaveBalance ],               // current leave year
  "payStructure": { PayStructure } | null,    // null unless hr:payroll_manage
  "payslips": [ PayslipSummary ] }            // [] unless hr:payroll_manage; newest 12
```
404 `NOT_FOUND` if the user is not an employee of this tenant.
### `GET /hr/employees/:userId/attendance?month=YYYY-MM` — `hr:view` → `{ month, days: [AttendanceDay], stats }`
### `PUT /hr/employees/:userId/work-setup` — `hr:settings_manage`
Body `{ "shiftId": "uuid|null", "weeklyOff": ["SUNDAY"] | null }` (each optional; `null` shiftId = use tenant default; `null` weeklyOff = inherit from shift/policy). Also keeps the legacy `StaffProfile.shift` text in sync (= shift name). → `{ "shift": ShiftRef|null, "weeklyOff": [...] }`.
### `GET /hr/employees/:userId/pay-structure` — `hr:payroll_manage` → `PayStructure`
### `PUT /hr/employees/:userId/pay-structure` — `hr:payroll_manage`
Body `{ "baseSalary"?: number >= 0, "components": [ { "name": "Travel allowance", "type": "ALLOWANCE", "amount": 1500, "isActive"?: true } ] }` — `components` replaces the whole set (max 20). `baseSalary` writes `StaffProfile.salaryAmount`. → `PayStructure`. Takes effect for the NEXT payroll generation / recalculation (existing payslips keep their snapshot until recalculated while DRAFT).

## 5. Attendance management

### `GET /hr/attendance?date=YYYY-MM-DD&branchId=&search=` — `hr:view` (date default today; not in the future… future dates allowed for read, returns computed rows)
```jsonc
{ "date": "2026-11-22",
  "summary": { "present": 1, "late": 1, "halfDay": 0, "onLeave": 1, "absent": 0, "weeklyOff": 0, "holiday": 0, "notMarked": 1 },
  "items": [ { "employee": { EmployeeRef }, "shift": { ShiftRef } | null, "attendance": { AttendanceDay } } ] }
```
### `GET /hr/attendance/monthly?month=YYYY-MM&branchId=` — `hr:view` — the grid
```jsonc
{ "month": "2026-11", "days": ["2026-11-01", "..."],
  "employees": [ { "employee": { EmployeeRef }, "cells": ["PRESENT", "WEEKLY_OFF", "LATE", "NOT_MARKED"], "stats": { AttendanceStats } } ] }   // cells[i] is the DayStatus for days[i]
```
### `PUT /hr/attendance` — `hr:attendance_manage` — mark / override one employee-day
Body: `{ "userId": "uuid", "date": "2026-11-20", "status": "PRESENT", "checkInTime": "06:10", "checkOutTime": "15:30", "remark": "Forgot to punch in" }`
- `remark` **required** (3–300 chars). `date` ≤ today and ≥ the employee's joining date.
- `checkInTime`/`checkOutTime` (IST `HH:mm`) only allowed with `PRESENT`/`LATE`/`HALF_DAY`; `checkOutTime` must be after `checkInTime`; `checkOutTime` requires `checkInTime`. For `ABSENT`/`ON_LEAVE`/`WEEKLY_OFF`/`HOLIDAY` times are rejected (422).
- `source = MANUAL`, `markedBy` = caller; overwrites any existing row (SELF/SYSTEM) for that day and clears its `leaveRequestId` (manual `ON_LEAVE` = **paid** leave in payroll; the balance of an approved leave request is NOT changed — cancel the request to restore it). `workedMinutes`/`lateMinutes`/`overtimeMinutes` are recomputed when times are given. Audit stores `before`/`after`.
→ 200 `AttendanceDay`.
### `POST /hr/attendance/bulk` — `hr:attendance_manage`
Body `{ "date": "2026-11-20", "remark": "Bulk mark – power cut", "entries": [ { "userId": "uuid", "status": "PRESENT", "checkInTime"?: "06:00", "checkOutTime"?: "21:00", "remark"?: "string" } ] }` (1–200 entries; per-entry `remark` overrides the shared one; a shared `remark` is required) → `{ "date": "...", "updated": 3, "items": [ AttendanceDay ] }`.
### `DELETE /hr/attendance?userId=uuid&date=YYYY-MM-DD&remark=...` — `hr:attendance_manage`
Removes the recorded row (the day falls back to computed status). `remark` required. → 200 `{ "date": "...", "userId": "uuid", "status": "ABSENT" /* computed result after delete */ }`. 404 if no row.

## 6. Leave management (`hr:leave_manage` unless noted)

### `GET /hr/leaves?status=&userId=&leaveTypeId=&from=&to=&page=&limit=` — `hr:leave_manage`
`from`/`to` = date-range overlap filter. Sorted PENDING first, then newest. Paginated `LeaveRequest` + `counts` (over the same filters except `status`): `{ "items": [...], "total": 9, "page": 1, "limit": 20, "totalPages": 1, "counts": { "pending": 3, "approved": 4, "rejected": 1, "cancelled": 1 } }`.
### `GET /hr/leaves/:id` — `hr:leave_manage` → `LeaveRequest` plus `"balance": LeaveBalance` (the applicant's balance for that type/year) and `"conflicts": [ { "employee": EmployeeRef, "leaveRequestId": "uuid", "startDate": "...", "endDate": "..." } ]` (other APPROVED/PENDING leaves overlapping the same dates — "who else is off")
### `POST /hr/leaves/preview` — `hr:leave_manage` — same as the self preview + `"userId"` in the body.
### `POST /hr/leaves` — apply on behalf — `hr:leave_manage`
Body: self-apply body + `"userId": "uuid"` + optional `"autoApprove": false` + optional `"remark"` (becomes `decisionRemark` when auto-approved). → **201** `LeaveRequest` with `appliedOnBehalf: true`. No back-date window limit for HR; every other validation of §3 applies. `autoApprove: true` = apply + approve in one step (then attendance rows are written, applicant notified `LEAVE_APPROVED`); not allowed for the caller's own userId (403). Without autoApprove the applicant is notified `LEAVE_APPLIED`-style ("HR applied leave for you") and approvers notified.
### `POST /hr/leaves/:id/approve` — body `{ "remark"?: "string ≤500" }` → `LeaveRequest` (`APPROVED`)
Only PENDING (else 409 `INVALID_STATE`). Re-validates overlap + balance (422 `INSUFFICIENT_LEAVE_BALANCE`). Side effects: for each covered **working** day, upsert attendance row (`FULL_DAY` ⇒ `ON_LEAVE`; half day ⇒ `HALF_DAY`), `source = SYSTEM`, `leaveRequestId` set, remark "Approved leave"; existing rows for those days are overwritten. Balance `used` increases automatically. Applicant notified (in-app + push) `LEAVE_APPROVED`.
### `POST /hr/leaves/:id/reject` — body `{ "remark": "string 3–500" }` **required** → `LeaveRequest` (`REJECTED`). Only PENDING (409 `INVALID_STATE`). Applicant notified with the remark.
### `POST /hr/leaves/:id/cancel` — body `{ "remark": "string 3–300" }` **required** → `LeaveRequest` (`CANCELLED`). PENDING or APPROVED (any date). APPROVED ⇒ SYSTEM attendance rows deleted. Applicant notified `LEAVE_CANCELLED`.
Status transitions: `PENDING → APPROVED | REJECTED | CANCELLED`, `APPROVED → CANCELLED`. `REJECTED` and `CANCELLED` are terminal.

### Leave balances
- `GET /hr/leave-balances?userId=&leaveYear=` — `hr:leave_manage`. With `userId`: `{ "userId": "uuid", "leaveYear": 2026, "leaveYearLabel": "2026-27", "periodStart": "...", "periodEnd": "...", "balances": [ LeaveBalance ] }`. Without: `{ ..., "employees": [ { "employee": EmployeeRef, "balances": [ LeaveBalance ] } ] }`.
- `POST /hr/leave-balances/adjust` — `hr:leave_manage` — body `{ "userId": "uuid", "leaveTypeId": "uuid", "leaveYear"?: 2026, "days": 2 | -1.5, "remark": "string 3–300" }` (`days` non-zero, signed; added to `adjustment`; resulting entitlement may not drop below `used + pending`, else 422) → `LeaveBalance`.

### Leave types
- `GET /hr/leave-types?includeInactive=false` — `hr:view` → `[ LeaveType ]` (sorted by `sortOrder`).
- `POST /hr/leave-types` — `hr:leave_manage` — body `{ "name": "Casual Leave", "code": "CASUAL", "yearlyQuota": 12|null, "isPaid": true, "carryForward": false, "carryForwardMax": null, "color": "#6366f1", "sortOrder": 1 }` → 201 `LeaveType`. `code` upper-case `[A-Z0-9_]{2,12}`, unique per tenant (409 `CONFLICT`).
- `PATCH /hr/leave-types/:id` — `hr:leave_manage` — any of the above + `isActive`. Changing `yearlyQuota` affects balance rows created from now on (existing leave-year rows keep their snapshot `quota`; use balance adjust to change them).
- `DELETE /hr/leave-types/:id` — `hr:leave_manage` — 409 `INVALID_STATE` when any leave request/balance uses it (deactivate instead). → `null`.

### Holidays
- `GET /hr/holidays?year=&from=&to=&branchId=` — `hr:view` → `[ Holiday ]` sorted by date (year default current calendar year).
- `POST /hr/holidays` — `hr:leave_manage` — `{ "date": "2026-12-25", "name": "Christmas", "description"?: "", "branchId"?: "uuid|null" }` → 201. Duplicate (same date + same branch scope) → 409 `CONFLICT`.
- `PATCH /hr/holidays/:id` / `DELETE /hr/holidays/:id` — `hr:leave_manage`. Holidays affect only *future computation* (leave day counting, computed attendance, payroll); existing leave requests keep their stored `days`.

## 7. Shifts & policy

- `GET /hr/shifts` — `hr:view` → `[ Shift ]`.
- `POST /hr/shifts` — `hr:settings_manage` — `{ "name": "Morning", "startTime": "06:00", "endTime": "14:00", "graceMinutes": 10, "weeklyOffDays": ["SUNDAY"], "isDefault"?: false }` → 201 (`endTime` > `startTime`; overnight shifts unsupported; `isDefault: true` un-defaults the previous default; name unique).
- `PATCH /hr/shifts/:id` — `hr:settings_manage` — any field + `isActive`.
- `DELETE /hr/shifts/:id` — `hr:settings_manage` — 409 `INVALID_STATE` if it is the default or employees are assigned.
- Assignment: `PUT /hr/employees/:userId/work-setup` (§4).
- `GET /hr/policy` — `hr:view` → `Policy`. `PUT /hr/policy` — `hr:settings_manage` — partial body of any `Policy` field except `workingDaysBasis` → `Policy`. Changing `leaveYearStartMonth` is rejected (409 `INVALID_STATE`) once any leave request exists... (balances are keyed by leave year).

## 8. Payroll (all `hr:payroll_manage`)

- `GET /hr/payroll/runs?page=&limit=` → paginated `PayrollRun` (newest month first).
- `POST /hr/payroll/runs` — body `{ "month": "2026-11", "notes"?: "" }` → **201** `{ "run": PayrollRun, "payslips": [ Payslip ] }`. `month` ≤ current IST month (422 otherwise; the current month is *provisional*: days after today count as paid). One run per month (409 `CONFLICT`). Generates a DRAFT payslip for every employee whose `joiningDate` ≤ month end and `workStatus != TERMINATED`.
- `GET /hr/payroll/runs/:id` → `{ "run": PayrollRun, "payslips": [ Payslip ] }`.
- `POST /hr/payroll/runs/:id/recalculate` — only while run is `DRAFT`: recomputes every DRAFT payslip from current attendance/leave/pay-structure/policy (manual lines, bonus & advance recovery are kept) and adds payslips for employees who appeared since → `{ run, payslips }`. 409 `INVALID_STATE` otherwise.
- `DELETE /hr/payroll/runs/:id` — only `DRAFT` → `null`.
- `PATCH /hr/payroll/payslips/:id` — only while payslip & run are DRAFT (409 `INVALID_STATE`). Body (all optional): `{ "bonus": 500, "advanceRecovery": 1000, "manualLines": [ { "name": "Incentive", "type": "ALLOWANCE", "amount": 750 }, { "name": "Uniform", "type": "DEDUCTION", "amount": 300 } ], "remark"?: "" }` — `manualLines` replaces the previous MANUAL lines (max 20, amount > 0). → `Payslip` with recomputed totals.
- `GET /hr/payroll/payslips/:id` → `Payslip`. `GET /hr/payroll/payslips/:id/pdf` → `application/pdf`.
- `POST /hr/payroll/runs/:id/approve` — only `DRAFT` (409 `INVALID_STATE`); needs ≥ 1 payslip; locks the run & payslip lines → `PayrollRun` (`APPROVED`). From now on employees can see their payslip.
- `POST /hr/payroll/payslips/:id/pay` — body `{ "paymentMode": "UPI", "paidOn"?: "2026-12-01", "remark"?: "Txn ref 123" }` — run must be `APPROVED`. Creates exactly ONE `Expense` (`category: SALARY`, `amount: netPay`, `expenseDate: paidOn` (default today IST), `description: "Salary – <name> – Nov 2026"`, no branch, `recordedBy` = caller) through the normal expense service, stores `expenseId`, sets `status: PAID`, `paidAt`, notifies the employee (`PAYSLIP_PAID`). If every payslip of the run is paid the run becomes `PAID`. A `netPay` of 0 is marked PAID without creating an expense. → `Payslip`.
  Errors: 409 `ALREADY_PAID` (second attempt / concurrent request — guarded by an atomic DRAFT→PAID claim plus a unique `expenseId`), 409 `INVALID_STATE` (run not approved).
- `POST /hr/payroll/runs/:id/pay-all` — same body as `pay` — pays every unpaid payslip of an `APPROVED` run → `{ "paid": 3, "skipped": 1, "failed": [ { "payslipId": "uuid", "message": "..." } ], "run": PayrollRun }` (`skipped` = already paid).

## 9. Rules & formulas (deterministic)

**Weekly off of an employee** = `StaffProfile.weeklyOff` (comma list) if set, else their (or the default) shift's `weeklyOffDays`, else `policy.defaultWeeklyOff` (`["SUNDAY"]`). **Holidays** apply when `branchId` is null or among the employee's branches. **Leave year** = `leaveYearStartMonth` (default April): the leave year labelled `2026` runs 1 Apr 2026 – 31 Mar 2027. Requests may not span two leave years. Balances are created lazily per (employee, type, leave year): `quota` = the type's quota at creation; `carriedForward` = `min(previous year's remaining, carryForwardMax ?? ∞)` when the type has `carryForward`.

**Leave days** = for each date in [start, end] that is not a weekly off and not a holiday: `1` (FULL_DAY) — a single-day half-day request counts `0.5` (only if that date is a working day).

**Attendance status on check-in/out**: shift start `S`, grace `g` (the shift's `graceMinutes`). `lateMinutes = max(0, checkInMinuteOfDayIST − (S + g))` → if > 0 then `LATE`. On check-out `worked = out − in` (minutes): `worked < halfDayThresholdHours × 60` ⇒ `HALF_DAY` (late minutes kept); `overtimeMinutes = max(0, worked − standardDayHours × 60)`.

**Absent is computed on read** (no scheduler writes it): a working day (not weekly off, not holiday, on/after joining date, **strictly before today**) with no attendance row is `ABSENT`. Today/future without a row = `NOT_MARKED`.

**Payroll month** = calendar month. Per employee:
- `workingDays` = calendar days − weekly-off days (holidays are **paid** and stay in the count).
- `monthlyGross = baseSalary + Σ active ALLOWANCE components` (`salaryType DAILY` ⇒ `base = salaryAmount × workingDays`; `HOURLY` ⇒ `salaryAmount × standardDayHours × workingDays`; `PER_SESSION` or missing salary ⇒ base 0 + a note).
- `dailyRate = round2(monthlyGross / workingDays)`.
- Per working day loss (`unpaidDays`): day before `joiningDate` ⇒ 1 (`notEmployedDays`); holiday ⇒ 0; attendance row `PRESENT`/`LATE` ⇒ 0; `HALF_DAY` without a leave link ⇒ 0.5; `HALF_DAY` from a half-day leave ⇒ 0 if the leave type is paid else 0.5; `ON_LEAVE` ⇒ 0 if the leave type is paid (or manual ON_LEAVE) else 1; `ABSENT` row or computed absent (past day, no row) ⇒ 1; `NOT_MARKED` (today/future) ⇒ 0.
- `attendanceDeduction = round2(min(monthlyGross, dailyRate × unpaidDays))`.
- `latePenalty = policy.latePenaltyEnabled ? floor(lateCount / latePenaltyLatesPerUnit) × latePenaltyDays × dailyRate : 0`.
- `overtimePay = policy.overtimeEnabled ? round2(overtimeMinutes/60 × (dailyRate / standardDayHours) × overtimeMultiplier) : 0`.
- `grossEarnings = monthlyGross − attendanceDeduction + overtimePay + extraAllowances + bonus`.
- `totalDeductions = fixedDeductions (active DEDUCTION components) + extraDeductions (MANUAL DEDUCTION lines) + latePenalty + advanceRecovery`.
- `netPay = max(0, grossEarnings − totalDeductions)`.
- Example (Nov 2026, 30 days, 4 Sundays ⇒ 26 working days): base 18000 + travel 1500 ⇒ gross 19500, daily rate 750; 1 absent + 1 half-day ⇒ unpaidDays 1.5 ⇒ deduction 1125; fixed deduction 500 ⇒ net 17875.

## 10. Notifications

In-app inbox = `hr_notifications` (per user; `/hr/me/notifications`) + FCM push to that user's staff devices. Triggers: leave applied (→ all `hr:leave_manage` holders except the applicant), leave approved/rejected/cancelled by HR (→ applicant, includes the remark), employee cancelled (→ approvers), payslip paid (→ employee). The tenant-wide staff Notification Center feed is NOT used (it is shared by all staff and would leak leave/salary data).

## 11. Error codes (additions to `ErrorCode`)

| HTTP | code | when |
|---|---|---|
| 403 | `FORBIDDEN` | missing permission / deciding own leave |
| 403 | `NOT_AN_EMPLOYEE` | `/hr/me/*` without a StaffProfile |
| 404 | `NOT_FOUND` | unknown id / not an employee of this tenant |
| 409 | `ALREADY_CHECKED_IN`, `NOT_CHECKED_IN`, `ALREADY_CHECKED_OUT` | attendance punch rules |
| 409 | `LEAVE_OVERLAP` | overlapping PENDING/APPROVED leave |
| 409 | `ALREADY_PAID` | payslip already paid |
| 409 | `INVALID_STATE` | status transition not allowed |
| 409 | `CONFLICT` | duplicates (leave type code, holiday date, run month, shift name) |
| 422 | `VALIDATION_ERROR` | body/query invalid, date rules |
| 422 | `INSUFFICIENT_LEAVE_BALANCE`, `NO_WORKING_DAYS` | leave apply/approve |

## 12. Audit actions

`hr.attendance_marked`, `hr.attendance_bulk_marked`, `hr.attendance_cleared`, `hr.attendance_checkin`, `hr.attendance_checkout`, `hr.leave_applied`, `hr.leave_approved`, `hr.leave_rejected`, `hr.leave_cancelled`, `hr.leave_balance_adjusted`, `hr.leave_type_created|updated|deleted`, `hr.holiday_created|updated|deleted`, `hr.shift_created|updated|deleted`, `hr.work_setup_updated`, `hr.policy_updated`, `hr.pay_structure_updated`, `hr.payroll_generated`, `hr.payroll_recalculated`, `hr.payroll_deleted`, `hr.payroll_approved`, `hr.payslip_updated`, `hr.payslip_paid` (entityType `hr_*`; `after` JSON carries `{ before, after }` where relevant).

## 13. Seed defaults (every tenant; new tenants at provisioning, existing via migration)

Leave types: **Casual Leave** (`CASUAL`, 12, paid, `#6366f1`), **Sick Leave** (`SICK`, 8, paid, `#ef4444`), **Paid Leave** (`PAID`, 15, paid, carry-forward up to 15, `#10b981`), **Unpaid Leave** (`UNPAID`, unlimited, unpaid, `#64748b`). Shift **General 06:00–21:00** (grace 10, weekly off SUNDAY, default). Policy defaults as in §2. Holidays are per-year data: `kaushal-fitness-club` has Nov–Dec 2026 samples; other tenants add their own.

## 14. As-built notes (verified live; read these, they refine the sections above)

- **Live status**: the API on `:4000` serves every endpoint here. `kaushal-fitness-club` has the default seed (4 leave types, shift "General 06:00-21:00", default policy) and sample Nov-Dec 2026 holidays (Diwali 8 Nov, Govardhan Puja 9 Nov, Bhai Dooj 11 Nov, Guru Nanak Jayanti 24 Nov, Christmas 25 Dec — marked "Sample date - verify").
- **Employees in the list are branch-scoped**: a user without "all branches" only sees/acts on employees who share one of their branches (same rule as Members/Finance). Owner = all branches.
- **Validation messages**: a missing/short `remark` on reject/cancel/manual-mark/clear/adjust is a 422 `VALIDATION_ERROR` with `errors[0].field = "remark"`.
- **Approve re-counts days**: at approval the covered dates are recomputed against the *current* weekly offs/holidays. If the count changed the request's `days` is updated (audit `daysRecounted: true`); if nothing is left to take leave from -> 422 `NO_WORKING_DAYS` (reject or cancel it instead).
- **Self-decision rule** applies to approve, reject, `autoApprove` and HR-cancel of a request whose `employee.userId` is the caller -> 403 `FORBIDDEN` (the owner, who has no StaffProfile, can always decide).
- **Shift rules**: the default shift cannot be un-defaulted, deactivated or deleted (make another shift default first); a shift with assigned employees cannot be deleted (409 `INVALID_STATE`); renaming a shift renames `StaffProfile.shift` text for its employees.
- **Leave balance adjust** on an unlimited type (no quota) -> 409 `INVALID_STATE`; an adjustment that would drop entitlement below used + pending -> 422.
- **Leave-year start month** cannot change once any leave request exists (409 `INVALID_STATE`).
- **Attendance row on check-in**: an HR-marked row that is ABSENT / WEEKLY_OFF / HOLIDAY without times can still be overridden by the employee's own check-in; any other HR-marked row blocks check-in (409 `INVALID_STATE`). A row created by an approved half-day leave (`leaveRequestId` set) keeps its `HALF_DAY` status when the employee punches in/out (times are recorded).
- **Payslip visibility for employees**: only payslips of runs in `APPROVED`/`PAID` are visible under `/hr/me/payslips`; a DRAFT payslip id returns 404 there.
- **Pay**: `paidOn` may not be in the future (422). `pay-all` on a DRAFT run -> 409 `INVALID_STATE`; on a PAID run every payslip is reported as `skipped`. Deleting a non-DRAFT run -> 409.
- **Overview**: `payroll` is `null` when the caller lacks `hr:payroll_manage`; `upcomingLeaves` is `[]` without `hr:leave_manage`. `pendingLeaves` is always the real count.
- **Notifications** are only created for users with an active account; push needs a registered staff FCM token (`POST /profile/device-token`).
- **Permission cache**: role/permission changes are cached per user for up to 30 min (Redis `perm:*`). After deploying this migration, clear `perm:*` keys (or wait) or existing users will not see the new `hr:*` keys until their cache expires / they re-login.

## Changelog
- v1 (initial contract, pre-implementation).
- v1.1 (as built): added section 14; `lateGraceMinutes` is the default grace for new shifts only (lateness uses the shift's grace); owner/non-employee behaviour clarified; swagger paths `/hr/*` registered (49).
