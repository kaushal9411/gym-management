import 'dart:typed_data';

/// The three formats `GET /reports/:reportType/export?format=` serves (web's
/// `ExportButtons`: CSV / Excel / PDF). [apiValue] is the `format` query value
/// (`xlsx`, not `excel`).
enum ReportExportFormat {
  pdf('pdf', 'PDF', 'application/pdf'),
  xlsx(
    'xlsx',
    'Excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ),
  csv('csv', 'CSV', 'text/csv');

  const ReportExportFormat(this.apiValue, this.label, this.mimeType);

  /// `format` query value and file extension.
  final String apiValue;

  /// Button label ("Excel" for `xlsx`).
  final String label;
  final String mimeType;

  String get extension => apiValue;
}

/// The download name: the server's `Content-Disposition` filename
/// (`<reportType>-<YYYY-MM-DD>.<ext>`) when it is present and safe, else the
/// same pattern built locally. Anything but letters, digits, `.`, `_` and `-`
/// is replaced and path parts are dropped, so the name can never escape the
/// temp folder it is written into.
String exportFilename(
  String? contentDisposition, {
  required String reportType,
  required ReportExportFormat format,
  DateTime? now,
}) {
  final fallback = '$reportType-${_day(now ?? DateTime.now())}.'
      '${format.extension}';
  if (contentDisposition == null) return fallback;
  final match = RegExp(
    r'''filename\*?=(?:UTF-8'')?"?([^";]+)"?''',
    caseSensitive: false,
  ).firstMatch(contentDisposition);
  var name = match?.group(1)?.trim() ?? '';
  name = name.split(RegExp(r'[\\/]')).last;
  name = name.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
  if (name.isEmpty || name.startsWith('.')) return fallback;
  if (!name.toLowerCase().endsWith('.${format.extension}')) return fallback;
  return name;
}

String _day(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}'
    '-${d.day.toString().padLeft(2, '0')}';

/// A downloaded export: the raw [bytes] plus the name the server gave it
/// (`<reportType>-<YYYY-MM-DD>.<ext>`) and the content type for the share
/// sheet.
class ReportExportFile {
  const ReportExportFile({
    required this.bytes,
    required this.filename,
    required this.format,
  });

  final Uint8List bytes;
  final String filename;
  final ReportExportFormat format;

  String get mimeType => format.mimeType;
}
