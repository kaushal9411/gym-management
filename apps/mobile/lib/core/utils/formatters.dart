/// Small, dependency-free formatters — kept here instead of pulling in
/// `intl` for a handful of one-line cases.
class Formatters {
  Formatters._();

  /// `₹4.1L`/`₹85,000`/`₹1,20,000` — Indian lakh grouping, matching the
  /// design's currency displays (`kaushalgym` seed data uses INR).
  static String currency(double amount) {
    final isNegative = amount < 0;
    final abs = amount.abs();
    String body;
    if (abs >= 100000) {
      body = '${(abs / 100000).toStringAsFixed(abs >= 1000000 ? 1 : 2)}L';
    } else {
      body = _groupIndian(abs.round());
    }
    return '${isNegative ? '-' : ''}₹$body';
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
