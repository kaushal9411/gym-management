import '../../core/di/service_locator.dart';
import '../../repositories/gym_settings_repository.dart';

/// Static, synchronously-readable cache of the signed-in gym's real currency
/// (symbol + ISO code), so `Formatters.currency`/`currencyCompact` don't
/// need to be async. Defaults to INR/₹ (this app's original hardcoded
/// assumption) until `refresh()` populates the real value — refreshed once
/// per staff session (`SessionCubit`), never for the member auth plane
/// (`GET /settings/business` is staff-only; member invoice screens keep the
/// INR default rather than risk a 403 against a staff-only endpoint — same
/// boundary tenant-web draws for its own member portal).
class AppCurrency {
  AppCurrency._();

  static String symbol = '₹';
  static String code = 'INR';

  /// Back to the INR default — called on sign-out/change-gym so a stale
  /// currency from the previous tenant's session never bleeds into the
  /// next one on the same device.
  static void reset() {
    symbol = '₹';
    code = 'INR';
  }

  static Future<void> refresh() async {
    try {
      final settings = await getIt<GymSettingsRepository>().getBusinessSettings();
      symbol = settings.currencySymbol;
      code = settings.currency;
    } catch (_) {
      // Keep whatever was already cached (or the INR default) — a failed
      // refresh should never crash or block whatever triggered it.
    }
  }
}
