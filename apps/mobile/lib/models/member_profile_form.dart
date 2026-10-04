/// Pure logic behind the member "Edit profile" form: option lists, the
/// server-mirroring validator and the changed-fields diff. No Flutter
/// imports so it is trivially unit-testable.
///
/// The staff member form has no enum option lists on mobile (it uses free
/// text for goals), so these mirror the backend's own zod enums in
/// `apps/api/src/modules/member-portal/validators/member-portal.validators.ts`.
library;

class ProfileOption {
  const ProfileOption(this.value, this.label);
  final String value;
  final String label;
}

const genderOptions = [
  ProfileOption('MALE', 'Male'),
  ProfileOption('FEMALE', 'Female'),
  ProfileOption('OTHER', 'Other'),
  ProfileOption('PREFER_NOT_TO_SAY', 'Prefer not to say'),
];

const maritalOptions = [
  ProfileOption('SINGLE', 'Single'),
  ProfileOption('MARRIED', 'Married'),
  ProfileOption('DIVORCED', 'Divorced'),
  ProfileOption('WIDOWED', 'Widowed'),
  ProfileOption('PREFER_NOT_TO_SAY', 'Prefer not to say'),
];

const goalOptions = [
  ProfileOption('WEIGHT_LOSS', 'Weight loss'),
  ProfileOption('WEIGHT_GAIN', 'Weight gain'),
  ProfileOption('MUSCLE_BUILDING', 'Muscle building'),
  ProfileOption('GENERAL_FITNESS', 'General fitness'),
  ProfileOption('ENDURANCE', 'Endurance'),
  ProfileOption('REHABILITATION', 'Rehabilitation'),
  ProfileOption('OTHER', 'Other'),
];

const bodyTypeOptions = [
  ProfileOption('ECTOMORPH', 'Ectomorph'),
  ProfileOption('MESOMORPH', 'Mesomorph'),
  ProfileOption('ENDOMORPH', 'Endomorph'),
  ProfileOption('AVERAGE', 'Average'),
  ProfileOption('UNKNOWN', 'Not sure'),
];

const foodPreferenceOptions = [
  ProfileOption('VEGETARIAN', 'Vegetarian'),
  ProfileOption('NON_VEGETARIAN', 'Non-vegetarian'),
  ProfileOption('VEGAN', 'Vegan'),
  ProfileOption('EGGETARIAN', 'Eggetarian'),
  ProfileOption('UNKNOWN', 'No preference'),
];

const bloodGroupOptions = [
  ProfileOption('A_POSITIVE', 'A+'),
  ProfileOption('A_NEGATIVE', 'A-'),
  ProfileOption('B_POSITIVE', 'B+'),
  ProfileOption('B_NEGATIVE', 'B-'),
  ProfileOption('AB_POSITIVE', 'AB+'),
  ProfileOption('AB_NEGATIVE', 'AB-'),
  ProfileOption('O_POSITIVE', 'O+'),
  ProfileOption('O_NEGATIVE', 'O-'),
  ProfileOption('UNKNOWN', 'Unknown'),
];

String optionLabel(List<ProfileOption> options, String value) {
  for (final o in options) {
    if (o.value == value) return o.label;
  }
  return value;
}

const _requiredKeys = {'firstName', 'lastName'};
const _numericKeys = {'height', 'weight'};

final _emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
final _phoneRe = RegExp(r'^\+?[0-9\s-]{7,15}$');
final _dateRe = RegExp(r'^\d{4}-\d{2}-\d{2}$');

/// Compares the form's current text values against the loaded baseline and
/// returns ONLY the keys that changed, ready for `PATCH /portal/profile`.
/// Text is trimmed; a cleared optional field becomes `null` (the server's
/// "clear" signal); height/weight go out as numbers. `currentPassword` is
/// never produced here (the screen adds it when email changed).
Map<String, Object?> changedProfileFields(
  Map<String, String> initial,
  Map<String, String> current,
) {
  final out = <String, Object?>{};
  for (final key in current.keys) {
    final before = (initial[key] ?? '').trim();
    final after = (current[key] ?? '').trim();
    if (key == 'email') {
      if (before.toLowerCase() == after.toLowerCase()) continue;
    } else if (_numericKeys.contains(key)) {
      final a = double.tryParse(before);
      final b = double.tryParse(after);
      if (a != null && b != null ? a == b : before == after) continue;
    } else if (before == after) {
      continue;
    }
    if (after.isEmpty) {
      out[key] = null;
    } else if (_numericKeys.contains(key)) {
      final n = double.tryParse(after);
      out[key] = n == null ? after : (n == n.roundToDouble() ? n.round() : n);
    } else {
      out[key] = after;
    }
  }
  return out;
}

/// True when the (trimmed, case-insensitive) email differs — the server then
/// demands `currentPassword`.
bool emailChanged(Map<String, String> initial, Map<String, String> current) =>
    (initial['email'] ?? '').trim().toLowerCase() !=
    (current['email'] ?? '').trim().toLowerCase();

/// Mirrors the server's zod rules for the keys present in [values]. Returns
/// field -> message (empty map = valid). [today] is injectable for tests.
Map<String, String> validateProfileValues(
  Map<String, String> values, {
  String? currentPassword,
  bool emailIsChanging = false,
  DateTime? today,
}) {
  final errors = <String, String>{};
  String v(String k) => (values[k] ?? '').trim();

  for (final k in _requiredKeys) {
    if (values.containsKey(k) && v(k).isEmpty) {
      errors[k] =
          k == 'firstName' ? 'First name is required' : 'Last name is required';
    }
  }
  void maxLen(String k, int n, String msg) {
    if (v(k).length > n) errors[k] = msg;
  }

  maxLen('firstName', 80, 'First name is too long');
  maxLen('lastName', 80, 'Last name is too long');
  maxLen('addressLine', 200, 'Address is too long');
  maxLen('city', 100, 'City is too long');
  maxLen('state', 100, 'State is too long');
  maxLen('country', 100, 'Country is too long');
  maxLen('postalCode', 20, 'Postal code is too long');
  maxLen('emergencyContactName', 120, 'Name is too long');
  maxLen('emergencyContactRelation', 60, 'Relation is too long');
  maxLen('occupation', 120, 'Occupation is too long');
  maxLen('fitnessGoals', 1000, 'Please keep this under 1000 characters');

  if (v('email').isNotEmpty) {
    if (!_emailRe.hasMatch(v('email'))) {
      errors['email'] = 'Enter a valid email address';
    } else if (v('email').length > 254) {
      errors['email'] = 'Email is too long';
    }
  }
  for (final k in const ['phone', 'emergencyContactPhone']) {
    if (v(k).isNotEmpty && !_phoneRe.hasMatch(v(k))) {
      errors[k] = 'Enter a valid phone number (7-15 digits)';
    }
  }
  final now = today ?? DateTime.now();
  final todayStr = '${now.year.toString().padLeft(4, '0')}-'
      '${now.month.toString().padLeft(2, '0')}-'
      '${now.day.toString().padLeft(2, '0')}';
  for (final k in const ['dateOfBirth', 'anniversary']) {
    final s = v(k);
    if (s.isEmpty) continue;
    if (!_dateRe.hasMatch(s) ||
        DateTime.tryParse(s) == null ||
        s.compareTo('1900-01-01') < 0) {
      errors[k] = 'Enter a valid date';
    } else if (k == 'dateOfBirth' && s.compareTo(todayStr) > 0) {
      errors[k] = 'Date of birth cannot be in the future';
    }
  }
  void range(String k, double min, double max, String msg) {
    if (v(k).isEmpty) return;
    final n = double.tryParse(v(k));
    if (n == null || n < min || n > max) errors[k] = msg;
  }

  range('height', 50, 300, 'Enter height in cm (50-300)');
  range('weight', 10, 500, 'Enter weight in kg (10-500)');

  if (emailIsChanging && (currentPassword ?? '').isEmpty) {
    errors['currentPassword'] = 'Enter your current password to change email';
  }
  return errors;
}
