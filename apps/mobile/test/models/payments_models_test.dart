import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/bloc/finance/payments_analytics_cubit.dart';
import 'package:gym_saas_mobile/features/finance/presentation/payments_ui.dart';
import 'package:gym_saas_mobile/models/member_payment.dart';
import 'package:gym_saas_mobile/models/member_summary.dart';
import 'package:gym_saas_mobile/models/payable_invoice.dart';
import 'package:gym_saas_mobile/models/payment_link_result.dart';

Map<String, dynamic> rawPayment({
  String status = 'SUCCESS',
  String finalAmount = '1180.00',
  String totalRefunded = '0.00',
  List<Map<String, dynamic>>? refunds,
}) =>
    {
      'id': 'p1',
      'paymentNumber': 'PAY-0001',
      'member': {'id': 'm1', 'memberId': 'MEM-0001', 'name': 'Riya Shah'},
      'branch': {'id': 'b1', 'name': 'Bandra'},
      'membership': {'id': 'ms1', 'planName': 'Gold'},
      'invoiceId': 'inv1',
      'amount': '1000.00',
      'discount': '0.00',
      'tax': '180.00',
      'finalAmount': finalAmount,
      'method': 'UPI',
      'paymentDate': '2026-10-03',
      'transactionReference': 'UTR123',
      'status': status,
      'createdAt': '2026-10-03T10:15:00.000Z',
      'totalRefunded': totalRefunded,
      if (refunds != null) ...{
        'notes': 'hello',
        'updatedAt': '2026-10-03T10:15:00.000Z',
        'recordedBy': {'id': 'u1', 'name': 'Asha Rao'},
        'refunds': refunds,
      },
    };

void main() {
  group('MemberPayment', () {
    test('parses decimal STRINGS and the detail-only fields', () {
      final p = MemberPayment.fromJson(
        rawPayment(
          totalRefunded: '180.00',
          refunds: [
            {
              'id': 'r1',
              'amount': '180.00',
              'reason': 'Duplicate charge',
              'refundedBy': {'id': 'u1', 'name': 'Asha Rao'},
              'refundedAt': '2026-10-04T09:00:00.000Z',
            },
          ],
        ),
      );
      expect(p.finalAmount, 1180);
      expect(p.amount, 1000);
      expect(p.tax, 180);
      expect(p.discount, 0);
      expect(p.reference, 'UTR123');
      expect(p.memberId, 'm1');
      expect(p.planName, 'Gold');
      expect(p.recordedByName, 'Asha Rao');
      expect(p.notes, 'hello');
      expect(p.refunds.single.amount, 180);
      expect(p.refunds.single.refundedByName, 'Asha Rao');
      expect(p.createdAt, isNotNull);
      expect(p.totalRefunded, 180);
    });

    test('is tolerant: numbers, missing blocks, list rows without refunds', () {
      final p = MemberPayment.fromJson({
        'id': 'x',
        'paymentNumber': 'PAY-2',
        'member': {'name': 'A'},
        'finalAmount': 50,
        'method': 'CASH',
        'paymentDate': '2026-10-03',
        'status': 'PENDING',
      });
      expect(p.finalAmount, 50);
      expect(p.totalRefunded, 0);
      expect(p.refunds, isEmpty);
      expect(p.branchName, '');
      expect(p.canCancel, isTrue);
    });

    test('refund rules are unchanged', () {
      final ok = MemberPayment.fromJson(rawPayment());
      expect(ok.canRefund, isTrue);
      expect(ok.refundableAmount, 1180);
      expect(ok.refundableShown, 1180);
      expect(ok.netReceived, 1180);
      expect(ok.statusAfterRefund(null), 'REFUNDED');
      expect(ok.statusAfterRefund(100), 'PARTIALLY_REFUNDED');
      expect(ok.statusAfterRefund(1180), 'REFUNDED');

      final partial = MemberPayment.fromJson(
        rawPayment(status: 'PARTIALLY_REFUNDED', totalRefunded: '1000.00'),
      );
      expect(partial.canRefund, isTrue);
      expect(partial.refundableAmount, closeTo(180, 1e-9));
      expect(partial.netReceived, closeTo(180, 1e-9));

      final done = MemberPayment.fromJson(
        rawPayment(status: 'REFUNDED', totalRefunded: '1180.00'),
      );
      expect(done.canRefund, isFalse);
      expect(done.refundableShown, 0);

      final pending = MemberPayment.fromJson(rawPayment(status: 'PENDING'));
      expect(pending.canRefund, isFalse);
      expect(pending.isReceived, isFalse);
      expect(pending.netReceived, 0);
    });

    test('cancel rule: not once refunded / cancelled', () {
      expect(
        MemberPayment.fromJson(rawPayment(status: 'CANCELLED')).canCancel,
        isFalse,
      );
      expect(
        MemberPayment.fromJson(rawPayment(status: 'REFUNDED')).canCancel,
        isFalse,
      );
      final withRefund = MemberPayment.fromJson(
        rawPayment(
          status: 'PARTIALLY_REFUNDED',
          totalRefunded: '10.00',
          refunds: [
            {
              'id': 'r',
              'amount': '10.00',
              'refundedAt': '2026-10-04T09:00:00.000Z',
            },
          ],
        ),
      );
      expect(withRefund.canCancel, isFalse);
    });
  });

  group('labels + wire values', () {
    test('offline methods map to the backend enum', () {
      expect(
        PaymentMethod.values.map((m) => m.apiValue).toList(),
        [
          'CASH',
          'UPI',
          'DEBIT_CARD',
          'CREDIT_CARD',
          'BANK_TRANSFER',
          'CHEQUE',
        ],
      );
      expect(PaymentMethod.cash.label, 'Cash');
      expect(paymentMethodLabel('ONLINE_GATEWAY'), 'Online Gateway');
      expect(paymentMethodLabel('BANK_TRANSFER'), 'Bank Transfer');
      expect(paymentMethodValues.length, 7);
    });

    test('statuses are the six wire values with web labels', () {
      expect(paymentStatusValues, [
        'SUCCESS',
        'PENDING',
        'PARTIALLY_REFUNDED',
        'REFUNDED',
        'FAILED',
        'CANCELLED',
      ]);
      expect(paymentStatusLabel('PARTIALLY_REFUNDED'), 'Partially refunded');
    });

    test('payMoney keeps paise and drops them when whole', () {
      expect(payMoney(1180), '₹1,180');
      expect(payMoney(0.5), '₹0.50');
      expect(payMoney(1234.5), '₹1,234.50');
      expect(payMoney(-20), '-₹20');
    });

    test('payDate shows the calendar day it names', () {
      expect(payDate(DateTime(2026, 10, 3)), '3 Oct 2026');
      expect(payDate(DateTime(2026, 10, 3), year: false), '3 Oct');
    });
  });

  group('record-payment models', () {
    test('MemberSummary reads contact, plan and dues', () {
      final m = MemberSummary.fromJson({
        'id': 'm1',
        'memberId': 'MEM-0001',
        'name': 'Riya Shah',
        'email': 'r@x.test',
        'phone': null,
        'outstandingAmount': '250.50',
        'currentMembership': {
          'planName': 'Gold',
          'endDate': '2026-12-01T00:00:00.000Z',
        },
      });
      expect(m.hasEmail, isTrue);
      expect(m.hasPhone, isFalse);
      expect(m.outstandingAmount, 250.5);
      expect(m.planName, 'Gold');
      expect(m.planEndDate, isNotNull);
      final bare = MemberSummary.fromJson({'id': 'x'});
      expect(bare.hasEmail, isFalse);
      expect(bare.outstandingAmount, 0);
    });

    test('InvoiceDue = total minus SUCCESS payments, never negative', () {
      final d = InvoiceDue.fromJson({
        'invoiceNumber': 'INV-1',
        'totalAmount': '1000.00',
        'payments': [
          {'status': 'SUCCESS', 'finalAmount': '400.00'},
          {'status': 'FAILED', 'finalAmount': '600.00'},
          {'status': 'SUCCESS', 'finalAmount': '100.00'},
        ],
      });
      expect(d.paid, 500);
      expect(d.due, 500);
      final over = InvoiceDue.fromJson({
        'invoiceNumber': 'INV-2',
        'totalAmount': '100.00',
        'payments': [
          {'status': 'SUCCESS', 'finalAmount': '150.00'},
        ],
      });
      expect(over.due, 0);
    });

    test('PayableInvoice parses', () {
      final i = PayableInvoice.fromJson({
        'id': 'i1',
        'invoiceNumber': 'INV-1',
        'totalAmount': '300.00',
        'status': 'PARTIALLY_PAID',
        'dueDate': '2026-10-20T00:00:00.000Z',
      });
      expect(i.total, 300);
      expect(i.isPartiallyPaid, isTrue);
    });

    test('PaymentLinkResult keeps the notified flags', () {
      final r = PaymentLinkResult.fromJson({
        'payment': rawPayment(status: 'PENDING'),
        'shortUrl': 'https://rzp.io/x',
        'paymentLinkId': 'pl_1',
        'notifiedEmail': true,
        'notifiedSms': false,
      });
      expect(r.shortUrl, 'https://rzp.io/x');
      expect(r.notifiedEmail, isTrue);
      expect(r.notifiedSms, isFalse);
      expect(r.payment.status, 'PENDING');
    });
  });

  test('PaymentsPeriod ranges are UTC days ending today', () {
    final now = DateTime.utc(2026, 10, 18, 3);
    final month = PaymentsPeriod.thisMonth.range(now);
    expect(month.from, '2026-10-01');
    expect(month.to, '2026-10-18');
    final last = PaymentsPeriod.lastMonth.range(now);
    expect(last.from, '2026-09-01');
    expect(last.to, '2026-09-30');
    final today = PaymentsPeriod.today.range(now);
    expect(today.from, '2026-10-18');
    expect(today.to, '2026-10-18');
  });
}
