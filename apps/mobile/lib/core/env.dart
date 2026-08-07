/// Runtime environment config. The Android emulator reaches the host
/// machine's localhost via 10.0.2.2, not 127.0.0.1 — override with
/// --dart-define=API_BASE_URL=... for a physical device on the same LAN.
class Env {
  Env._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000/api/v1',
  );

  static const String defaultTenantSlug = String.fromEnvironment(
    'DEFAULT_TENANT_SLUG',
    defaultValue: '',
  );
}
