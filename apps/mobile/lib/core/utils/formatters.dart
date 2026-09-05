import 'app_currency.dart';

/// Small, dependency-free formatters — kept here instead of pulling in
/// `intl` for a handful of one-line cases.
class Formatters {
  Formatters._();

  /// `₹4.1L`/`₹85,000`/`₹1,20,000` (Indian lakh grouping) when the signed-in
  /// gym's currency is actually INR (`AppCurrency.code`, the common case —
  /// see its own doc comment); otherwise the real symbol with standard
  /// thousands-grouping (`$120,000`), since lakh-grouping is meaningless
  /// outside INR.
  static String currency(double amount) {
    final isNegative = amount < 0;
    final abs = amount.abs();
    final symbol = AppCurrency.symbol;
    final body = AppCurrency.code == 'INR'
        ? (abs >= 100000
            ? '${(abs / 100000).toStringAsFixed(abs >= 1000000 ? 1 : 2)}L'
            : _groupIndian(abs.round()))
        : _groupWestern(abs.round());
    return '${isNegative ? '-' : ''}$symbol$body';
  }

  /// `₹13k`/`₹5.2k`/`₹4.1L` (INR) or `$13k`/`$5.2k`/`$4.1M` (other
  /// currencies) — compact form for space-constrained tiles (KPI cards),
  /// where the full grouped-digit form (`currency` above) wraps to a
  /// second line once the value is more than ~4 digits.
  static String currencyCompact(double amount) {
    final isNegative = amount < 0;
    final abs = amount.abs();
    final symbol = AppCurrency.symbol;
    final isInr = AppCurrency.code == 'INR';
    String body;
    if (isInr && abs >= 100000) {
      body = '${(abs / 100000).toStringAsFixed(abs >= 1000000 ? 1 : 2)}L';
    } else if (!isInr && abs >= 1000000) {
      final m = abs / 1000000;
      body = '${m.toStringAsFixed(m >= 10 ? 0 : 1)}M';
    } else if (abs >= 1000) {
      final k = abs / 1000;
      body = '${k.toStringAsFixed(k >= 10 ? 0 : 1)}k';
    } else {
      body = abs.round().toString();
    }
    return '${isNegative ? '-' : ''}$symbol$body';
  }

  static String _groupIndian(int value) {
    final s = value.toString();
    if (s.length <= 3) return s;
    final last3 = s.substring(s.length - 3);
    final rest = s.substring(0, s.length - 3);
    final grouped = rest.replaceAllMapped(
      RegExp(r'(\d)(?=(\d\d)+(?!\d))'),
      (m) => '${m[1]},',
    );
    return '$grouped,$last3';
  }

  /// Standard thousands-grouping (`120,000`), used for every non-INR
  /// currency — Indian lakh-grouping (`_groupIndian`) doesn't apply.
  static String _groupWestern(int value) {
    final s = value.toString();
    return s.replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
      (m) => '${m[1]},',
    );
  }

  /// "14 min ago" / "2 hr ago" / "3d ago" — relative time, coarse enough for
  /// an activity feed (no need for `timeago`'s full locale machinery).
  static String relativeTime(DateTime from) {
    final diff = DateTime.now().difference(from);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} hr ago';
    if (diff.inDays < 30) return '${diff.inDays}d ago';
    return '${from.day}/${from.month}/${from.year}';
  }
}
