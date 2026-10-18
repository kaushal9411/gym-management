import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/member_payment.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../payments_ui.dart';

/// One row of the Payments list (web's table row as a card): member avatar,
/// payment number with its "Razorpay link" / "Invoice linked" hint, member,
/// plan · branch, method + date, amount (with the refunded part), status and
/// the ⋯ menu (View details / View invoice / Verify status / Copy number).
class PaymentCard extends StatelessWidget {
  const PaymentCard({
    super.key,
    required this.payment,
    required this.onTap,
    required this.onMenu,
    this.canViewInvoice = false,
    this.canVerify = false,
  });

  final MemberPayment payment;
  final VoidCallback onTap;

  /// `view` | `invoice` | `verify` | `copy`.
  final ValueChanged<String> onMenu;
  final bool canViewInvoice;
  final bool canVerify;

  @override
  Widget build(BuildContext context) {
    final p = payment;
    final color = PayColors.status(p.status);
    final hint = p.method == 'ONLINE_GATEWAY'
        ? 'Razorpay link'
        : (p.invoiceId != null ? 'Invoice linked' : null);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.fromLTRB(12, 12, 4, 12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: color.withValues(alpha: 0.25)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                PayAvatar(name: p.memberName, seed: p.memberId, size: 42),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              p.paymentNumber,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.tabular(
                                size: 13,
                                color: TeamColors.indigo,
                                weight: FontWeight.w800,
                              ),
                            ),
                          ),
                          if (hint != null) ...[
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                hint,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 10.5,
                                  color: AppColors.inkFaint,
                                  weight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        p.memberName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(size: 14, weight: FontWeight.w800),
                      ),
                      Text(
                        [
                          p.memberCode,
                          if (p.planName != null) p.planName!,
                          if (p.branchName.isNotEmpty) p.branchName,
                        ].join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 11.5,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          payMethodTag(p.method),
                          Text(
                            payDate(p.paymentDate),
                            style: AppText.body(
                              size: 11.5,
                              color: AppColors.inkSoft,
                              weight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      payMoney(p.finalAmount),
                      style: AppText.display(size: 17),
                    ),
                    if (p.totalRefunded > 0)
                      Text(
                        '-${payMoney(p.totalRefunded)} refunded',
                        style: AppText.body(
                          size: 10.5,
                          color: TeamColors.rose,
                          weight: FontWeight.w800,
                        ),
                      ),
                    const SizedBox(height: 6),
                    payStatusTag(p.status),
                  ],
                ),
                _menu(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _menu() {
    return PopupMenuButton<String>(
      tooltip: 'Actions for ${payment.paymentNumber}',
      icon: Icon(Icons.more_vert_rounded, size: 20, color: AppColors.inkFaint),
      color: AppColors.surface2,
      padding: EdgeInsets.zero,
      onSelected: onMenu,
      itemBuilder: (_) => [
        const PopupMenuItem(value: 'view', child: Text('View details')),
        if (payment.invoiceId != null && canViewInvoice)
          const PopupMenuItem(value: 'invoice', child: Text('View invoice')),
        if (canVerify && payment.status == 'PENDING')
          const PopupMenuItem(value: 'verify', child: Text('Verify status')),
        const PopupMenuItem(value: 'copy', child: Text('Copy number')),
      ],
    );
  }
}
