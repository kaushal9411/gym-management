import '../../../../core/utils/formatters.dart';
import '../../../income/presentation/income_ui.dart' show shortDay;

/// How a chart / tile value is written. The unit travels with the data, so a
/// count chart can never grow a currency symbol (web had that bug once).
///
///  * [money]   — the gym's currency (`AppCurrency`): `₹85,000` / `₹1.2L` (symbol and grouping come from `Formatters`)
///  * [number]  — a plain count: `1,240`
///  * [percent] — a value already on a 0..100 scale: `42%` / `42.5%`
enum RptFormat { number, money, percent }

/// `1,240` — standard thousands grouping, no symbol.
String rptGrouped(double v) {
  final s = v.round().abs().toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(',');
    b.write(s[i]);
  }
  return '${v.round() < 0 ? '-' : ''}$b';
}

/// Formats [v] as [f]. [compact] shortens big values for axes and tight
/// tiles (`₹4.1L` / `12k`).
String rptFormatValue(RptFormat f, double v, {bool compact = false}) {
  switch (f) {
    case RptFormat.money:
      return compact ? Formatters.currencyCompact(v) : Formatters.currency(v);
    case RptFormat.percent:
      final whole = v == v.roundToDouble();
      return '${whole ? v.round() : v.toStringAsFixed(1)}%';
    case RptFormat.number:
      if (compact && v.abs() >= 1000) {
        final k = v / 1000;
        return '${k.toStringAsFixed(k.abs() >= 10 ? 0 : 1).replaceAll(RegExp(r'\.0$'), '')}k';
      }
      return rptGrouped(v);
  }
}

/// % change of [value] vs [previous]. Null when there is no baseline to
/// compare with (previous missing, or 0 while the value is positive — the UI
/// shows "New" instead of an invented +100%). Web's `pctChange`.
double? rptPctChange(double value, double? previous) {
  if (previous == null) return null;
  if (previous <= 0) return value > 0 ? null : 0;
  return (value - previous) / previous * 100;
}

/// "18 Oct" from `YYYY-MM-DD` / ISO text (no timezone maths, so a date-only
/// value can never shift a day).
String rptShortDate(String iso) => shortDay(iso);

/// The 7 weekday labels, Monday first (web's `WEEKDAY_ORDER`).
const kRptWeekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/// API weekday (0 = Sunday .. 6 = Saturday, 7 also Sunday) -> index into
/// [kRptWeekdays] (Monday first).
int rptWeekdayIndex(int apiWeekday) => (apiWeekday + 6) % 7;

/// "6 PM" / "12 AM" for an hour 0..23.
String rptHourLabel(int h) {
  final suffix = h >= 12 ? 'PM' : 'AM';
  final hh = h % 12 == 0 ? 12 : h % 12;
  return '$hh $suffix';
}

/// "6p" / "12a" — the tight axis form.
String rptHourTick(int h) =>
    '${h % 12 == 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}';

/// `PENDING_VERIFICATION` / `bank-transfer` -> `Pending Verification`.
String rptTitleCase(String s) => s
    .replaceAll(RegExp('[_-]+'), ' ')
    .toLowerCase()
    .split(' ')
    .where((w) => w.isNotEmpty)
    .map((w) => '${w[0].toUpperCase()}${w.substring(1)}')
    .join(' ');
