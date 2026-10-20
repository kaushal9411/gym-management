/// `1234` -> `1,234`, `100000` -> `1,00,000` (Indian grouping, like the
/// design's `toLocaleString('en-IN')`). The app has no intl package.
String groupDigits(int n) {
  final s = n.abs().toString();
  String grouped;
  if (s.length <= 3) {
    grouped = s;
  } else {
    final head = s.substring(0, s.length - 3);
    final tail = s.substring(s.length - 3);
    final parts = <String>[];
    for (var i = head.length; i > 0; i -= 2) {
      parts.insert(0, head.substring(i - 2 < 0 ? 0 : i - 2, i));
    }
    grouped = '${parts.join(',')},$tail';
  }
  return n < 0 ? '-$grouped' : grouped;
}
