import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/session/session_cubit.dart';
import '../../../../bloc/session/session_state.dart';
import '../../../../core/di/service_locator.dart';
import '../../../../core/export/export_sink.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/report_export.dart';
import '../../../../models/report_summary.dart';
import '../../../../repositories/reports_repository.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import 'rpt_theme.dart';

/// What one report screen exposes to the export action — web's
/// `<ExportButtons reportType filters />`.
class RptExportSpec {
  const RptExportSpec({
    required this.reportType,
    required this.title,
    required this.filters,
    this.enabled = true,
  });

  /// `GET /reports/:reportType/export` id: `revenue`, `trainer-performance`,
  /// `analytics-revenue-trends`, ... (the API's 18 report types).
  final String reportType;

  /// Human title (the sheet subtitle and the print job name).
  final String title;

  /// The screen's CURRENT filters (period, branch, status, plan ...), read
  /// when an export is tapped so the file matches what is on screen.
  final ReportSummaryFilters Function() filters;

  /// False while the screen has nothing valid to export (an inverted or
  /// over-long custom range).
  final bool enabled;
}

/// Same key web's `ExportButtons` checks. Reads (and watches) the staff
/// session; member sessions and signed-out states never see the action.
bool rptCanExport(BuildContext context) {
  final s = context.watch<SessionCubit>().state;
  return s is SessionAuthenticatedStaff &&
      s.user.hasPermission('reports:export');
}

/// "Export" entry point of a report: a translucent hero pill (icon +
/// "Export") or, with [compact], the small icon button of the results-list
/// header. Opens [showRptExportSheet]. Renders nothing without
/// `reports:export`.
class RptExportButton extends StatelessWidget {
  const RptExportButton({
    super.key,
    required this.spec,
    this.compact = false,
    this.sink,
    this.repository,
  });

  final RptExportSpec spec;

  /// Small icon-only variant for the results header (not on the hero).
  final bool compact;

  /// Test overrides; default to the `get_it` singletons.
  final ExportSink? sink;
  final ReportsRepository? repository;

  @override
  Widget build(BuildContext context) {
    if (!rptCanExport(context)) return const SizedBox.shrink();
    void open() => showRptExportSheet(
          context,
          spec: spec,
          sink: sink,
          repository: repository,
        );
    final onTap = spec.enabled ? open : null;
    if (compact) {
      return Tooltip(
        message: 'Export report',
        child: Material(
          color: RptColors.indigo.withValues(alpha: 0.14),
          shape: const CircleBorder(),
          child: InkWell(
            key: const Key('rpt-export-list'),
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: SizedBox(
              width: 36,
              height: 36,
              child: Icon(
                Icons.file_download_outlined,
                size: 19,
                color: onTap == null ? AppColors.inkFaint : RptColors.indigo,
              ),
            ),
          ),
        ),
      );
    }
    return GestureDetector(
      key: const Key('rpt-export-hero'),
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? 0.5 : 1,
        child: Container(
          height: 38,
          padding: const EdgeInsets.symmetric(horizontal: 13),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadii.pill),
            color: Colors.white.withValues(alpha: 0.18),
            border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.file_download_outlined,
                color: Colors.white,
                size: 19,
              ),
              const SizedBox(width: 6),
              Text(
                'Export',
                style: AppText.body(
                  size: 13,
                  weight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Opens the export bottom sheet (PDF, Excel, CSV, Print) — capped at 640 dp
/// on tablets by [showTeamSheet].
Future<void> showRptExportSheet(
  BuildContext context, {
  required RptExportSpec spec,
  ExportSink? sink,
  ReportsRepository? repository,
}) {
  final messenger = ScaffoldMessenger.of(context);
  return showTeamSheet<void>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: Icons.file_download_outlined,
      title: 'Export report',
      subtitle: spec.title,
      color: RptColors.indigo,
      child: RptExportOptions(
        spec: spec,
        messenger: messenger,
        sink: sink,
        repository: repository,
      ),
    ),
  );
}

enum _Action { pdf, xlsx, csv, print }

extension on _Action {
  ReportExportFormat get format => switch (this) {
        _Action.pdf || _Action.print => ReportExportFormat.pdf,
        _Action.xlsx => ReportExportFormat.xlsx,
        _Action.csv => ReportExportFormat.csv,
      };

  String get title => switch (this) {
        _Action.pdf => 'PDF',
        _Action.xlsx => 'Excel',
        _Action.csv => 'CSV',
        _Action.print => 'Print',
      };

  String get hint => switch (this) {
        _Action.pdf => 'Formatted document to read or share',
        _Action.xlsx => 'Spreadsheet (.xlsx) for Excel or Sheets',
        _Action.csv => 'Plain comma-separated values (.csv)',
        _Action.print => 'Send the report to a printer',
      };

  IconData get icon => switch (this) {
        _Action.pdf => Icons.picture_as_pdf_rounded,
        _Action.xlsx => Icons.table_chart_rounded,
        _Action.csv => Icons.description_rounded,
        _Action.print => Icons.print_rounded,
      };

  Color get color => switch (this) {
        _Action.pdf => RptColors.rose,
        _Action.xlsx => RptColors.green,
        _Action.csv => RptColors.teal,
        _Action.print => RptColors.indigo,
      };

  String get done => switch (this) {
        _Action.print => 'Sent to the printer',
        _ => '$title exported',
      };
}

/// The sheet body: one row per [_Action]. Downloading shows a spinner on the
/// tapped row and disables the others; on success the sheet closes and the
/// host screen shows a SnackBar, on failure the server's message is shown in
/// the sheet and in a SnackBar and the rows are usable again.
class RptExportOptions extends StatefulWidget {
  const RptExportOptions({
    super.key,
    required this.spec,
    required this.messenger,
    this.sink,
    this.repository,
  });

  final RptExportSpec spec;

  /// The host screen's messenger (the sheet's own route is gone by the time a
  /// success message should appear).
  final ScaffoldMessengerState messenger;
  final ExportSink? sink;
  final ReportsRepository? repository;

  @override
  State<RptExportOptions> createState() => _RptExportOptionsState();
}

class _RptExportOptionsState extends State<RptExportOptions> {
  _Action? _busy;
  String? _error;

  Rect? _origin() {
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.attached) return null;
    return box.localToGlobal(Offset.zero) & box.size;
  }

  Future<void> _run(_Action action) async {
    if (_busy != null) return;
    setState(() {
      _busy = action;
      _error = null;
    });
    final navigator = Navigator.of(context);
    final origin = _origin();
    String? failure;
    var done = false;
    try {
      final repository = widget.repository ?? getIt<ReportsRepository>();
      final sink = widget.sink ?? getIt<ExportSink>();
      final file = await repository.exportReport(
        widget.spec.reportType,
        action.format,
        widget.spec.filters(),
      );
      // The sheet was closed while the server rendered the file: do not pop
      // a share sheet / print dialog the user no longer expects.
      if (!mounted) return;
      done = action == _Action.print
          ? await sink.printPdf(file, jobName: widget.spec.title)
          : await sink.share(file, origin: origin);
    } on ApiException catch (e) {
      failure = e.detailedMessage;
    } catch (_) {
      failure = 'Could not export this report. Please try again.';
    }
    if (mounted) {
      setState(() {
        _busy = null;
        _error = failure;
      });
    }
    if (failure != null) {
      widget.messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(failure)));
    } else if (done) {
      if (mounted && navigator.canPop()) navigator.pop();
      widget.messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(action.done)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // Closing mid-download would orphan the request.
      canPop: _busy == null,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final a in _Action.values)
              _ExportRow(
                action: a,
                busy: _busy == a,
                disabled: _busy != null && _busy != a,
                onTap: () => _run(a),
              ),
            if (_error != null)
              Container(
                key: const Key('rpt-export-error'),
                margin: const EdgeInsets.only(top: 6),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.dangerSoft,
                  borderRadius: BorderRadius.circular(AppRadii.field),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.error_outline_rounded,
                      size: 18,
                      color: AppColors.danger,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _error!,
                        style: AppText.body(
                          size: 12.5,
                          weight: FontWeight.w600,
                          color: AppColors.danger,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ExportRow extends StatelessWidget {
  const _ExportRow({
    required this.action,
    required this.busy,
    required this.disabled,
    required this.onTap,
  });

  final _Action action;
  final bool busy;
  final bool disabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = action.color;
    return Opacity(
      opacity: disabled ? 0.45 : 1,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          key: Key('rpt-export-${action.name}'),
          borderRadius: BorderRadius.circular(AppRadii.field),
          onTap: busy || disabled ? null : onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  alignment: Alignment.center,
                  child: Icon(action.icon, size: 22, color: color),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        action.title,
                        style: AppText.body(
                          size: 14.5,
                          weight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        busy ? 'Preparing…' : action.hint,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 12,
                          weight: FontWeight.w600,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                busy
                    ? SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.4,
                          color: color,
                        ),
                      )
                    : Icon(
                        Icons.chevron_right_rounded,
                        color: AppColors.inkFaint,
                      ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
