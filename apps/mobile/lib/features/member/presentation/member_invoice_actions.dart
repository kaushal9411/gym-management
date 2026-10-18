import 'dart:developer' as developer;

import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/export/export_sink.dart';
import '../../../core/network/api_exception.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../team/presentation/widgets/team_ui.dart' show teamSnack;

/// Downloads an invoice PDF and hands it to the user: fetch
/// (`GET /portal/invoices/:id/download`), then the system share sheet
/// ("Save to Files", "Open with…"). If the share sheet cannot open (a plugin
/// problem on the device) it falls back to the PDF preview / print dialog,
/// which also offers Save and Share. Every failure shows what actually went
/// wrong and at which step, never a bare "could not download".
Future<void> downloadMemberInvoice(
  BuildContext context, {
  required String invoiceId,
  required String invoiceNumber,
}) async {
  final sink = getIt<ExportSink>();
  try {
    final file = await getIt<MemberPortalRepository>()
        .downloadInvoice(invoiceId, invoiceNumber);
    try {
      await sink.share(file);
    } catch (e, st) {
      // Share sheet unavailable — fall back to the PDF preview.
      developer.log(
        'Invoice share failed',
        name: 'MemberInvoice',
        error: e,
        stackTrace: st,
      );
      await sink.printPdf(file, jobName: invoiceNumber);
    }
  } on ApiException catch (e) {
    if (context.mounted) {
      teamSnack(
        context,
        'Could not get the invoice: ${e.detailedMessage}',
        error: true,
      );
    }
  } catch (e, st) {
    developer.log(
      'Invoice PDF failed',
      name: 'MemberInvoice',
      error: e,
      stackTrace: st,
    );
    if (context.mounted) {
      teamSnack(context, 'Could not open the invoice PDF ($e)', error: true);
    }
  }
}
