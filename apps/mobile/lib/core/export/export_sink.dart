import 'dart:io';
import 'dart:ui' show Rect;

import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';

import '../../models/report_export.dart';

/// Where a downloaded report goes. The report export widget never touches a
/// platform plugin directly — it hands the bytes to an [ExportSink], so
/// widget tests swap in a fake and need no platform channels.
///
/// Registered in `get_it` as [PlatformExportSink] (`service_locator.dart`).
abstract class ExportSink {
  /// Writes [file] to a temp file and opens the system share sheet (which
  /// also offers "Save to Files / Drive" and "Open with Excel / PDF viewer").
  /// Returns `false` when the user closed the sheet without choosing
  /// anything, `true` otherwise. [origin] anchors the iPad popover.
  Future<bool> share(ReportExportFile file, {Rect? origin});

  /// Opens the system print dialog for a PDF [file]. Returns `false` when the
  /// user cancelled. [jobName] is the print job's title.
  Future<bool> printPdf(ReportExportFile file, {required String jobName});
}

/// The real thing: `path_provider` (temp folder) + `share_plus` (share sheet)
/// + `printing` (system print dialog).
class PlatformExportSink implements ExportSink {
  const PlatformExportSink();

  /// Sub-folder of the temp directory holding shared exports.
  static const _folder = 'report_exports';

  @override
  Future<bool> share(ReportExportFile file, {Rect? origin}) async {
    final path = await _write(file);
    final result = await SharePlus.instance.share(
      ShareParams(
        files: [XFile(path, name: file.filename, mimeType: file.mimeType)],
        subject: file.filename,
        sharePositionOrigin: origin,
      ),
    );
    return result.status != ShareResultStatus.dismissed;
  }

  @override
  Future<bool> printPdf(ReportExportFile file, {required String jobName}) {
    return Printing.layoutPdf(
      name: jobName,
      onLayout: (_) async => file.bytes,
    );
  }

  /// Writes the bytes under `<temp>/report_exports/<filename>` and prunes
  /// exports older than a day (a share target may still be reading a recent
  /// one, so nothing newer is touched).
  Future<String> _write(ReportExportFile file) async {
    final base = await getTemporaryDirectory();
    final dir = Directory('${base.path}${Platform.pathSeparator}$_folder');
    await dir.create(recursive: true);
    await _prune(dir);
    final target = File('${dir.path}${Platform.pathSeparator}${file.filename}');
    await target.writeAsBytes(file.bytes, flush: true);
    return target.path;
  }

  Future<void> _prune(Directory dir) async {
    final cutoff = DateTime.now().subtract(const Duration(days: 1));
    try {
      await for (final entity in dir.list()) {
        if (entity is File && entity.lastModifiedSync().isBefore(cutoff)) {
          await entity.delete();
        }
      }
    } catch (_) {
      // Housekeeping only — never block an export on it.
    }
  }
}
