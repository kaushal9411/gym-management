import 'app_routes.dart';

/// Where an HR notification (the in-app inbox row or an FCM push) should land,
/// by its `HrNotificationType` (`docs/HR-API-CONTRACT.md` §0). Pure, so the
/// push handler, the inbox screen and the tests share one mapping.
///
/// * `LEAVE_APPLIED` / `LEAVE_CANCELLED` go to approvers -> the approvals inbox.
/// * `PAYSLIP_PAID` -> My payslips.
/// * `LEAVE_APPROVED` / `LEAVE_REJECTED` (and anything unknown) -> My leaves.
String hrRouteForNotification(String type) => switch (type) {
      'LEAVE_APPLIED' || 'LEAVE_CANCELLED' => AppRoutes.hrApprovals,
      'PAYSLIP_PAID' => AppRoutes.hrPayslips,
      _ => AppRoutes.hrMyLeaves,
    };

/// The tray-notification payload for an FCM data message: `hr:<hrType>` for an
/// HR push (`data = { type: 'hr', hrType: ... }`), otherwise `null` (the tap
/// then opens the notification list as before).
String? pushTapPayload(Map<String, dynamic> data) {
  final hrType = data['hrType'];
  return data['type'] == 'hr' && hrType is String && hrType.isNotEmpty
      ? 'hr:$hrType'
      : null;
}

/// The route a tap payload (`hr:<hrType>`) deep-links to, or `null` when the
/// payload is not an HR one.
String? routeForPushPayload(String? payload) {
  if (payload == null || !payload.startsWith('hr:')) return null;
  return hrRouteForNotification(payload.substring(3));
}
