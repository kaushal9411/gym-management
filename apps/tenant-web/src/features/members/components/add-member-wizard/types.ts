import type { Gender } from '../../types';

/** Core `Member` profile fields (pre-existing on the backend since Prompt 14) that the wizard's step 1 collects inline — kept separate from `MemberExtendedInfoFormState`/`MemberHealthFormState` (the genuinely new field groups added in Prompt 82), since the edit page already has its own inline rendering of these same core fields and doesn't need this type. */
export interface WizardCorePersonalState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  memberId: string;
  branchId: string;
  trainerId: string;
  gender: Gender | '';
  height: string;
  weight: string;
  occupation: string;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  joiningDate: string;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
}

export function defaultWizardCorePersonalState(): WizardCorePersonalState {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    memberId: '',
    branchId: '',
    trainerId: '',
    gender: '',
    height: '',
    weight: '',
    occupation: '',
    addressLine: '',
    city: '',
    state: '',
    country: 'India',
    postalCode: '',
    joiningDate: new Date().toISOString().slice(0, 10),
    dobDay: '',
    dobMonth: '',
    dobYear: '',
  };
}

/** Composes the wizard's 3 separate Day/Month/Year inputs into the single ISO date `Member.dateOfBirth` expects — returns `undefined` when any part is missing (DOB stays optional). */
export function composeDateOfBirth(state: Pick<WizardCorePersonalState, 'dobDay' | 'dobMonth' | 'dobYear'>): string | undefined {
  const day = Number(state.dobDay);
  const month = Number(state.dobMonth);
  const year = Number(state.dobYear);
  if (!day || !month || !year) return undefined;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/** Whole-years age from the composed DOB, or `null` when DOB is incomplete/invalid. */
export function computeAge(state: Pick<WizardCorePersonalState, 'dobDay' | 'dobMonth' | 'dobYear'>): number | null {
  const iso = composeDateOfBirth(state);
  if (!iso) return null;
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

export interface WizardPaymentState {
  amount: string;
  discount: string;
  method: string;
}

export function defaultWizardPaymentState(): WizardPaymentState {
  return { amount: '', discount: '', method: 'CASH' };
}
