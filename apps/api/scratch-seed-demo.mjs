// One-off demo-data seeding script for Play Store screenshots.
// Targets production directly via the real HTTP API (not raw SQL) so every
// write goes through normal validation/business logic/cascades.
// Run with: node scratch-seed-demo.mjs
// Safe to delete after use — not part of the app.

const BASE = 'https://api.appkraft.info/api/v1';
const TENANT_SLUG = 'kaushal-fitness-club';
const OWNER_EMAIL = 'kaushalchauhan9411@gmail.com';
const OWNER_PASSWORD = 'Kaushal@9411';

let accessToken = null;
let tokenExpiresAt = 0;

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': TENANT_SLUG },
    body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
  });
  const json = await res.json();
  if (!json.success) throw new Error('Login failed: ' + JSON.stringify(json));
  accessToken = json.data.accessToken;
  tokenExpiresAt = Date.now() + 13 * 60 * 1000; // refresh a bit before real 15min expiry
  console.log('Logged in as', json.data.user.email);
}

async function ensureToken() {
  if (!accessToken || Date.now() > tokenExpiresAt) await login();
}

async function api(method, path, body) {
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
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const results = { branches: [], staff: [], plans: [], members: [], foods: [], dietPlans: [], classes: [] };

async function run() {
  await login();

  // ---- Branches ----
  console.log('\n== Branches ==');
  const branchDefs = [
    { name: 'Downtown', city: 'Noida', addressLine1: 'Sector 18, Noida' },
    { name: 'Uptown', city: 'Greater Noida', addressLine1: 'Alpha Commercial Belt' },
  ];
  for (const b of branchDefs) {
    const created = await api('POST', '/branches', { name: b.name, city: b.city, addressLine1: b.addressLine1, country: 'India', capacity: 200 });
    if (created) {
      results.branches.push(created);
      console.log('  branch:', created.name);
    }
  }
  const mainBranches = await api('GET', '/branches?limit=100');
  results.branches = mainBranches?.items ?? results.branches;
  console.log('  total branches:', results.branches.length);

  // ---- Staff ----
  console.log('\n== Staff ==');
  const staffDefs = [
    { firstName: 'Rohit', lastName: 'Sharma', email: 'trainer.rohit@fitcloud-demo.info', role: 'TRAINER' },
    { firstName: 'Priya', lastName: 'Verma', email: 'trainer.priya@fitcloud-demo.info', role: 'TRAINER' },
    { firstName: 'Amit', lastName: 'Kumar', email: 'manager.amit@fitcloud-demo.info', role: 'MANAGER' },
    { firstName: 'Sneha', lastName: 'Patel', email: 'reception.sneha@fitcloud-demo.info', role: 'RECEPTIONIST' },
    { firstName: 'Vikram', lastName: 'Singh', email: 'reception.vikram@fitcloud-demo.info', role: 'RECEPTIONIST' },
  ];
  for (let i = 0; i < staffDefs.length; i++) {
    const s = staffDefs[i];
    const branch = results.branches[i % results.branches.length];
    const created = await api('POST', '/staff', {
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      role: s.role,
      primaryBranchId: branch.id,
      joiningDate: isoDate(daysAgo(randInt(60, 400))),
    });
    if (created) {
      results.staff.push(created);
      console.log(`  staff: ${s.firstName} ${s.lastName} (${s.role}) @ ${branch.name}`);
    }
  }
  const trainers = results.staff.filter((s) => s.role === 'TRAINER' || staffDefs.find((d) => d.email === s.email)?.role === 'TRAINER');

  // ---- Membership plans ----
  console.log('\n== Membership plans ==');
  const planDefs = [
    { name: 'Basic Monthly', durationValue: 1, durationType: 'MONTHS', price: 1500, joiningFee: 500 },
    { name: 'Standard Quarterly', durationValue: 3, durationType: 'MONTHS', price: 4000, joiningFee: 500 },
    { name: 'Premium Half-Yearly', durationValue: 6, durationType: 'MONTHS', price: 7500, joiningFee: 0 },
    { name: 'Elite Annual', durationValue: 12, durationType: 'MONTHS', price: 13000, joiningFee: 0 },
  ];
  for (const p of planDefs) {
    const created = await api('POST', '/membership-plans', { ...p, category: 'General', isActive: true });
    if (created) {
      results.plans.push(created);
      console.log('  plan:', created.name);
    }
  }

  // ---- Members ----
  console.log('\n== Members ==');
  const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Krishna', 'Ishaan', 'Ananya', 'Diya', 'Saanvi', 'Myra', 'Kabir', 'Rohan', 'Neha', 'Pooja', 'Karan', 'Simran', 'Arjun', 'Meera', 'Tanvi'];
  const lastNames = ['Gupta', 'Sharma', 'Verma', 'Yadav', 'Mehta', 'Joshi', 'Reddy', 'Nair', 'Malhotra', 'Bhatt'];
  const goals = ['WEIGHT_LOSS', 'WEIGHT_GAIN', 'MUSCLE_BUILDING', 'GENERAL_FITNESS', 'ENDURANCE'];
  const foodPrefs = ['VEGETARIAN', 'NON_VEGETARIAN', 'VEGAN', 'EGGETARIAN'];
  const genders = ['MALE', 'FEMALE'];

  // The specific requested member first
  const deeksha = await api('POST', '/members', {
    firstName: 'Deeksha',
    lastName: 'Thakur',
    email: 'deekshathakur9695@gmail.com',
    phone: '9876543210',
    gender: 'FEMALE',
    dateOfBirth: '1998-04-12',
    bloodGroup: 'O_POSITIVE',
    height: 162,
    weight: 58,
    occupation: 'Software Engineer',
    addressLine: 'Sector 62',
    city: 'Noida',
    state: 'Uttar Pradesh',
    country: 'India',
    postalCode: '201301',
    joiningDate: isoDate(daysAgo(75)),
    branchId: results.branches[0].id,
    trainerId: trainers[0]?.id,
    goal: 'WEIGHT_LOSS',
    foodPreference: 'VEGETARIAN',
    bodyType: 'ECTOMORPH',
    registrationFee: 500,
    fitnessGoals: 'Lose 5kg and build lean muscle over the next 6 months.',
  });
  if (deeksha) {
    results.members.push(deeksha);
    console.log('  member: Deeksha Thakur (target member)');
  }

  for (let i = 0; i < 18; i++) {
    const fn = pick(firstNames);
    const ln = pick(lastNames);
    const branch = results.branches[i % results.branches.length];
    const created = await api('POST', '/members', {
      firstName: fn,
      lastName: ln,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@fitcloud-demo.info`,
      phone: `9${randInt(100000000, 999999999)}`,
      gender: pick(genders),
      dateOfBirth: isoDate(daysAgo(randInt(7000, 16000))),
      height: randInt(150, 190),
      weight: randInt(50, 95),
      city: pick(['Noida', 'Greater Noida', 'Delhi', 'Ghaziabad']),
      country: 'India',
      joiningDate: isoDate(daysAgo(randInt(5, 300))),
      branchId: branch.id,
      trainerId: trainers.length ? pick(trainers).id : undefined,
      goal: pick(goals),
      foodPreference: pick(foodPrefs),
    });
    if (created) {
      results.members.push(created);
      process.stdout.write('.');
    }
  }
  console.log(`\n  total members created: ${results.members.length}`);

  // ---- Assign memberships + payments (-> auto invoice + income) ----
  console.log('\n== Memberships + Payments ==');
  const methods = ['CASH', 'UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'ONLINE_GATEWAY'];
  for (const m of results.members) {
    const plan = pick(results.plans);
    const startDate = isoDate(daysAgo(randInt(0, 80)));
    const membership = await api('PUT', `/members/${m.id}/membership`, {
      planId: plan.id,
      startDate,
      autoRenew: Math.random() > 0.5,
    });
    if (!membership) continue;
    const membershipId = membership.membershipHistory?.[0]?.id ?? membership.id;
    const amount = plan.price;
    await api('POST', '/payments', {
      memberId: m.id,
      membershipId,
      branchId: m.branchId,
      amount,
      method: pick(methods),
      paymentDate: startDate,
      status: 'SUCCESS',
      notes: `Payment for ${plan.name}`,
    });
    process.stdout.write('.');
  }
  console.log('\n  memberships + payments done');

  // ---- Extra income entries ----
  console.log('\n== Extra income ==');
  const incomeCats = ['PERSONAL_TRAINING', 'PRODUCT_SALES', 'OTHER'];
  for (let i = 0; i < 20; i++) {
    await api('POST', '/income', {
      category: pick(incomeCats),
      amount: randInt(500, 5000),
      incomeDate: isoDate(daysAgo(randInt(0, 90))),
      branchId: pick(results.branches).id,
      description: pick(['Personal training session', 'Supplement sale', 'Merchandise sale', 'Guest pass fee']),
    });
    process.stdout.write('.');
  }
  console.log('\n  income entries done');

  // ---- Expenses ----
  console.log('\n== Expenses ==');
  const expenseCats = ['RENT', 'SALARY', 'UTILITIES', 'EQUIPMENT', 'MAINTENANCE', 'MARKETING', 'OFFICE_SUPPLIES', 'OTHER'];
  for (let i = 0; i < 25; i++) {
    await api('POST', '/expenses', {
      category: pick(expenseCats),
      amount: randInt(1000, 40000),
      expenseDate: isoDate(daysAgo(randInt(0, 90))),
      branchId: pick(results.branches).id,
      description: pick(['Monthly rent', 'Staff salary', 'Electricity bill', 'New equipment', 'AC maintenance', 'Social media ads', 'Stationery']),
    });
    process.stdout.write('.');
  }
  console.log('\n  expenses done');

  // ---- Attendance history ----
  console.log('\n== Attendance ==');
  const attendanceMembers = results.members.slice(0, 12);
  for (const m of attendanceMembers) {
    const visits = randInt(8, 20);
    for (let v = 0; v < visits; v++) {
      const dayOffset = randInt(0, 45);
      const checkInRec = await api('POST', '/attendance/manual-check-in', { memberId: m.id, branchId: m.branchId });
      if (!checkInRec) continue;
      const checkOutRec = await api('POST', '/attendance/manual-check-out', { memberId: m.id });
      const day = daysAgo(dayOffset);
      const hour = randInt(6, 20);
      const checkInTime = new Date(day);
      checkInTime.setHours(hour, randInt(0, 59), 0, 0);
      const checkOutTime = new Date(checkInTime);
      checkOutTime.setMinutes(checkOutTime.getMinutes() + randInt(30, 90));
      const recId = checkOutRec?.id ?? checkInRec.id;
      await api('PATCH', `/attendance/${recId}`, {
        checkInTime: checkInTime.toISOString(),
        checkOutTime: checkOutTime.toISOString(),
      });
      process.stdout.write('.');
    }
  }
  console.log('\n  attendance done');

  // ---- Foods + Diet plans ----
  console.log('\n== Diet plans ==');
  const foodDefs = [
    { name: 'Grilled Chicken Breast', category: 'Protein', calories: 165, protein: 31 },
    { name: 'Brown Rice', category: 'Carbs', calories: 216, protein: 5 },
    { name: 'Broccoli', category: 'Vegetable', calories: 55, protein: 4 },
    { name: 'Paneer', category: 'Protein', calories: 265, protein: 18 },
    { name: 'Oats', category: 'Carbs', calories: 389, protein: 17 },
    { name: 'Banana', category: 'Fruit', calories: 89, protein: 1 },
    { name: 'Almonds', category: 'Nuts', calories: 579, protein: 21 },
    { name: 'Whey Protein Shake', category: 'Supplement', calories: 120, protein: 24 },
  ];
  for (const f of foodDefs) {
    const created = await api('POST', '/foods', f);
    if (created) results.foods.push(created);
  }
  const dietPlanDefs = [
    { name: 'Weight Loss Plan', goal: 'Weight Loss', dailyCalories: 1600, durationDays: 90 },
    { name: 'Muscle Gain Plan', goal: 'Muscle Building', dailyCalories: 2600, durationDays: 120 },
    { name: 'General Maintenance Plan', goal: 'Maintenance', dailyCalories: 2000, durationDays: 60 },
  ];
  for (const p of dietPlanDefs) {
    const created = await api('POST', '/diet-plans', { ...p, trainerId: trainers[0]?.id, isActive: true });
    if (created) {
      results.dietPlans.push(created);
      console.log('  diet plan:', created.name);
    }
  }
  // Assign diet plans to some members (incl. Deeksha)
  const dietTargets = [deeksha, ...results.members.slice(1, 6)].filter(Boolean);
  for (const m of dietTargets) {
    const plan = pick(results.dietPlans);
    if (plan) await api('POST', `/diet-plans/${plan.id}/assign`, { memberId: m.id, startDate: isoDate(daysAgo(randInt(0, 30))) });
  }
  console.log('  diet plan assignments done');

  // ---- Classes ----
  console.log('\n== Classes ==');
  const classDefs = [
    { name: 'Morning Yoga', durationMinutes: 60, days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'], time: '07:00' },
    { name: 'Zumba Blast', durationMinutes: 45, days: ['TUESDAY', 'THURSDAY'], time: '18:00' },
    { name: 'CrossFit Circuit', durationMinutes: 50, days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'], time: '19:00' },
    { name: 'Spin Class', durationMinutes: 40, days: ['SATURDAY'], time: '09:00' },
  ];
  for (const c of classDefs) {
    const branch = pick(results.branches);
    const created = await api('POST', '/classes', {
      name: c.name,
      branchId: branch.id,
      trainerId: trainers.length ? pick(trainers).id : undefined,
      capacity: randInt(15, 30),
      durationMinutes: c.durationMinutes,
      isActive: true,
    });
    if (!created) continue;
    results.classes.push(created);
    await api('PATCH', `/classes/${created.id}/schedule`, {
      slots: c.days.map((d) => ({ dayOfWeek: d, startTime: c.time })),
    });
    await api('POST', '/class-sessions/generate', { daysAhead: 21 });
    console.log('  class:', created.name);
  }
  // Book a few sessions
  const sessions = await api('GET', '/class-sessions?limit=50');
  if (sessions?.items?.length) {
    for (let i = 0; i < 15; i++) {
      const session = pick(sessions.items);
      const member = pick(results.members);
      await api('POST', '/bookings', { sessionId: session.id, memberId: member.id });
      process.stdout.write('.');
    }
    console.log('\n  bookings done');
  }

  console.log('\n\n=== DONE ===');
  console.log('Branches:', results.branches.length);
  console.log('Staff:', results.staff.length);
  console.log('Plans:', results.plans.length);
  console.log('Members:', results.members.length);
  console.log('Diet plans:', results.dietPlans.length);
  console.log('Classes:', results.classes.length);
}

run().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
