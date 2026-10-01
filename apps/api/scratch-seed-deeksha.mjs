// Focused seed script: attendance + workout plan + diet plan + classes for
// Deeksha Thakur specifically. Paced with delays to avoid the rate limiter
// that killed the earlier bulk run. Run with: node scratch-seed-deeksha.mjs

const BASE = 'https://api.appkraft.info/api/v1';
const TENANT_SLUG = 'kaushal-fitness-club';
const OWNER_EMAIL = 'kaushalchauhan9411@gmail.com';
const OWNER_PASSWORD = 'Kaushal@9411';
const DEEKSHA_ID = '420574b0-3b0d-4ead-a73b-a8e0e8d1bfd6';
const BRANCH_ID = 'a1c4415c-0562-4e8b-8fda-74f25295460a';
const TRAINER_ID = 'e802d116-a20c-4c8f-ac4a-df789c1ea11b'; // Priya Verma

let accessToken = null;
let tokenExpiresAt = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': TENANT_SLUG },
    body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
  });
  const json = await res.json();
  if (!json.success) throw new Error('Login failed: ' + JSON.stringify(json));
  accessToken = json.data.accessToken;
  tokenExpiresAt = Date.now() + 13 * 60 * 1000;
  console.log('Logged in as', json.data.user.email);
}

async function ensureToken() {
  if (!accessToken || Date.now() > tokenExpiresAt) await login();
}

async function api(method, path, body, retry = true) {
  await ensureToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': TENANT_SLUG,
      Authorization: `Bearer ${accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = { success: false, raw: await res.text() };
  }
  if (!json.success) {
    const code = json.errors?.[0]?.code;
    if (code === 'RATE_LIMITED' && retry) {
      console.log('  rate limited, waiting 5s...');
      await sleep(5000);
      return api(method, path, body, false);
    }
    console.error(`  FAILED ${method} ${path}:`, JSON.stringify(json.errors || json.message || json));
    return null;
  }
  return json.data;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function run() {
  await login();

  // ---- Attendance history for Deeksha (already done in a previous run) ----
  const SKIP_ATTENDANCE = true;
  console.log('\n== Attendance for Deeksha ==');
  const visitDays = SKIP_ATTENDANCE ? [] : [2, 4, 5, 7, 9, 11, 12, 14, 16, 18, 19, 21, 23, 25, 27, 29, 31, 33, 35, 38, 40, 42];
  if (SKIP_ATTENDANCE) console.log('  skipped (already seeded)');
  for (const dayOffset of visitDays) {
    const checkInRec = await api('POST', '/attendance/manual-check-in', { memberId: DEEKSHA_ID, branchId: BRANCH_ID });
    await sleep(500);
    if (!checkInRec) continue;
    const checkOutRec = await api('POST', '/attendance/manual-check-out', { memberId: DEEKSHA_ID });
    await sleep(500);
    const day = daysAgo(dayOffset);
    const hour = randInt(6, 19);
    const checkInTime = new Date(day);
    checkInTime.setHours(hour, randInt(0, 59), 0, 0);
    const checkOutTime = new Date(checkInTime);
    checkOutTime.setMinutes(checkOutTime.getMinutes() + randInt(40, 80));
    const recId = checkOutRec?.id ?? checkInRec.id;
    await api('PATCH', `/attendance/${recId}`, {
      checkInTime: checkInTime.toISOString(),
      checkOutTime: checkOutTime.toISOString(),
    });
    await sleep(500);
    process.stdout.write('.');
  }
  console.log('\n  attendance done (', visitDays.length, 'visits)');

  // ---- Workout plan ----
  console.log('\n== Workout plan ==');
  const workoutPlan = await api('POST', '/workout-plans', {
    name: 'Fat Loss Strength Program',
    description: 'A 12-week strength + cardio program focused on sustainable fat loss and lean muscle retention.',
    goal: 'Weight Loss',
    level: 'BEGINNER',
    durationWeeks: 12,
    isActive: true,
  });
  await sleep(400);
  if (workoutPlan) {
    console.log('  created:', workoutPlan.name);
    await api('POST', `/workout-plans/${workoutPlan.id}/assign`, {
      memberId: DEEKSHA_ID,
      startDate: isoDate(daysAgo(14)),
      trainerRemarks: 'Focus on form for the first 2 weeks, then progressively increase load.',
    });
    await sleep(400);
    console.log('  assigned to Deeksha');
  }

  // ---- Diet plan ----
  console.log('\n== Diet plan ==');
  const foodDefs = [
    { name: 'Grilled Chicken Breast', category: 'Protein', calories: 165, protein: 31 },
    { name: 'Brown Rice', category: 'Carbs', calories: 216, protein: 5 },
    { name: 'Mixed Salad', category: 'Vegetable', calories: 40, protein: 2 },
    { name: 'Greek Yogurt', category: 'Dairy', calories: 100, protein: 10 },
  ];
  for (const f of foodDefs) {
    await api('POST', '/foods', f);
    await sleep(400);
  }
  const dietPlan = await api('POST', '/diet-plans', {
    name: 'Weight Loss Meal Plan',
    description: 'Balanced high-protein, moderate-carb meal plan to support the strength program.',
    goal: 'Weight Loss',
    dailyCalories: 1600,
    durationDays: 90,
    isActive: true,
  });
  await sleep(400);
  if (dietPlan) {
    console.log('  created:', dietPlan.name);
    await api('POST', `/diet-plans/${dietPlan.id}/assign`, {
      memberId: DEEKSHA_ID,
      startDate: isoDate(daysAgo(14)),
    });
    await sleep(400);
    console.log('  assigned to Deeksha');
  }

  // ---- Classes + booking ----
  console.log('\n== Classes ==');
  const classDefs = [
    { name: 'Morning Yoga', durationMinutes: 60, days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'], time: '07:00' },
    { name: 'Zumba Blast', durationMinutes: 45, days: ['TUESDAY', 'THURSDAY'], time: '18:00' },
  ];
  const createdClasses = [];
  for (const c of classDefs) {
    const created = await api('POST', '/classes', {
      name: c.name,
      branchId: BRANCH_ID,
      capacity: 20,
      durationMinutes: c.durationMinutes,
      isActive: true,
    });
    await sleep(400);
    if (!created) continue;
    createdClasses.push(created);
    await api('PATCH', `/classes/${created.id}/schedule`, {
      slots: c.days.map((d) => ({ dayOfWeek: d, startTime: c.time })),
    });
    await sleep(400);
    console.log('  class:', created.name);
  }
  await api('POST', '/class-sessions/generate', { daysAhead: 21 });
  await sleep(1000);

  const dateFrom = isoDate(new Date());
  const dateTo = isoDate(daysAgo(-21));
  const sessions = await api('GET', `/class-sessions?dateFrom=${dateFrom}&dateTo=${dateTo}`);
  await sleep(400);
  if (sessions?.items?.length) {
    for (const session of sessions.items.slice(0, 4)) {
      await api('POST', '/bookings', { sessionId: session.id, memberId: DEEKSHA_ID });
      await sleep(400);
      process.stdout.write('.');
    }
    console.log('\n  bookings done');
  } else {
    console.log('  no sessions generated yet');
  }

  console.log('\n\n=== DONE ===');
}

run().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
