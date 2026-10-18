import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/billing/presentation/billing_history_screen.dart';
import 'package:gym_saas_mobile/features/billing/presentation/billing_invoices_screen.dart';
import 'package:gym_saas_mobile/features/billing/presentation/billing_ui.dart';
import 'package:gym_saas_mobile/features/billing/presentation/plan_comparison.dart';
import 'package:gym_saas_mobile/models/billing_payment.dart';
import 'package:gym_saas_mobile/models/fitcloud_invoice.dart';
import 'package:gym_saas_mobile/models/subscription_plan_info.dart';
import 'package:gym_saas_mobile/models/subscription_plan_option.dart';

Map<String, dynamic> _plan(
        {Object? monthly = '1499.00', Object? yearly = '14990.00',}) =>
    {
      'slug': 'pro',
      'name': 'Professional',
      'description': 'For growing gyms',
      'sortOrder': 2,
      'priceMonthly': monthly,
      'priceYearly': yearly,
      'currency': 'INR',
      'maxBranches': 3,
      'maxStaff': 20,
      'maxMembers': 500,
    };

Map<String, dynamic> _payment(
  String id,
  String status,
  Object amount,
  String createdAt, {
  String currency = 'INR',
  String? failure,
}) =>
    {
      'id': id,
      'provider': 'razorpay',
      'status': status,
      'amount': amount,
      'currency': currency,
      'gatewayReference': null,
      'failureReason': failure,
      'createdAt': createdAt,
    };

Map<String, dynamic> _invoice(
  String id,
  String status,
  Object total, {
  String currency = 'INR',
}) =>
    {
      'id': id,
      'invoiceNumber': 'INV-$id',
      'status': status,
      'total': total,
      'currency': currency,
      'dueDate': null,
      'paidAt': null,
      'createdAt': '2026-10-05T10:00:00.000Z',
    };

void main() {
  group('subscription models', () {
    test('plan prices parse from decimal strings and numbers', () {
      final a = SubscriptionPlanInfo.fromJson(_plan());
      expect(a.priceMonthly, 1499);
      expect(a.priceYearly, 14990);
      expect(a.description, 'For growing gyms');
      final b =
          SubscriptionPlanInfo.fromJson(_plan(monthly: 999, yearly: 9990));
      expect(b.priceMonthly, 999);
      expect(b.maxMembers, 500);
    });

    test('subscription parses grace end, cycle price and cancellable', () {
      final s = TenantSubscription.fromJson({
        'status': 'GRACE',
        'billingCycle': 'YEARLY',
        'trialEndsAt': null,
        'currentPeriodStart': '2026-01-01T00:00:00.000Z',
        'currentPeriodEnd': '2027-01-01T00:00:00.000Z',
        'graceEndsAt': '2027-01-08T00:00:00.000Z',
        'cancelAtPeriodEnd': true,
        'plan': _plan(),
      });
      expect(s.graceEndsAt, isNotNull);
      expect(s.isYearly, isTrue);
      expect(s.cyclePrice, 14990);
      expect(s.cancelAtPeriodEnd, isTrue);
      expect(s.isCancellable, isTrue);
      final ended = TenantSubscription.fromJson({
        'status': 'EXPIRED',
        'billingCycle': 'MONTHLY',
        'currentPeriodStart': '2026-01-01T00:00:00.000Z',
        'plan': _plan(),
      });
      expect(ended.isCancellable, isFalse);
      expect(ended.currentPeriodEnd, isNull);
      expect(ended.cyclePrice, 1499);
    });

    test('plan option tolerates string prices and yearly saving maths', () {
      final p = SubscriptionPlanOption.fromJson({
        'id': 'p1',
        'slug': 'pro',
        'name': 'Pro',
        'description': 'd',
        'priceMonthly': '1000.00',
        'priceYearly': '9000.00',
        'currency': 'INR',
        'trialDays': 14,
        'sortOrder': 2,
        'limits': {
          'maxBranches': 1,
          'maxManagers': 1,
          'maxTrainers': 1,
          'maxReceptionists': 1,
          'maxStaff': 1,
          'maxMembers': 1,
          'maxStorageMb': 1,
        },
        'features': [
          {'key': 'a', 'label': 'A', 'included': true},
        ],
      });
      expect(p.priceMonthly, 1000);
      // 9000 vs 12 x 1000 -> 25%.
      expect(planYearlySavingPct(p), 25);
    });
  });

  group('payments and invoices', () {
    test('payment parses string amounts; refunded covers partial', () {
      final p = BillingPayment.fromJson(
        _payment('1', 'PARTIALLY_REFUNDED', '250.50', '2026-10-05T10:00:00Z'),
      );
      expect(p.amount, 250.5);
      expect(p.isRefunded, isTrue);
      expect(p.isSucceeded, isFalse);
    });

    test('invoice total parses from string and number', () {
      expect(
          FitCloudInvoice.fromJson(_invoice('1', 'PAID', '99.90')).total, 99.9,);
      expect(FitCloudInvoice.fromJson(_invoice('2', 'OPEN', 120)).total, 120);
    });

    test('history stats: totals, last payment, months, counts', () {
      final stats = PaymentHistoryStats.from([
        BillingPayment.fromJson(
          _payment('3', 'SUCCEEDED', '1000.00', '2026-10-15T12:00:00Z'),
        ),
        BillingPayment.fromJson(
          _payment('2', 'FAILED', '1000.00', '2026-10-10T12:00:00Z',
              failure: 'x',),
        ),
        BillingPayment.fromJson(
          _payment('1', 'SUCCEEDED', '500.00', '2026-09-15T12:00:00Z'),
        ),
        BillingPayment.fromJson(
          _payment('0', 'PARTIALLY_REFUNDED', '100.00', '2026-08-15T12:00:00Z'),
        ),
        // Other currency is ignored in the money totals.
        BillingPayment.fromJson(
          _payment('9', 'SUCCEEDED', '77.00', '2026-10-01T12:00:00Z',
              currency: 'USD',),
        ),
      ]);
      expect(stats.currency, 'INR');
      expect(stats.total, 1500);
      expect(stats.paidCount, 3);
      expect(stats.failed, 1);
      expect(stats.last!.id, '3');
      expect(stats.points.map((p) => p.amount), [500, 1000]);
      expect(stats.counts['ALL'], 5);
      expect(stats.counts['SUCCEEDED'], 3);
      expect(stats.counts['REFUNDED'], 1);
      expect(stats.counts.containsKey('PARTIALLY_REFUNDED'), isFalse);
    });

    test('empty history falls back to INR and zeros', () {
      final stats = PaymentHistoryStats.from(const []);
      expect(stats.currency, 'INR');
      expect(stats.total, 0);
      expect(stats.last, isNull);
      expect(stats.points, isEmpty);
    });

    test('REFUNDED filter matches partial refunds too', () {
      final partial = BillingPayment.fromJson(
        _payment('1', 'PARTIALLY_REFUNDED', '1', '2026-10-05T10:00:00Z'),
      );
      expect(paymentMatchesFilter(partial, 'REFUNDED'), isTrue);
      expect(paymentMatchesFilter(partial, 'SUCCEEDED'), isFalse);
      expect(paymentMatchesFilter(partial, 'ALL'), isTrue);
    });

    test('invoice totals exclude draft & void; outstanding is OPEN only', () {
      final t = InvoiceTotals.from([
        FitCloudInvoice.fromJson(_invoice('1', 'PAID', '1000')),
        FitCloudInvoice.fromJson(_invoice('2', 'OPEN', '400')),
        FitCloudInvoice.fromJson(_invoice('3', 'DRAFT', '50')),
        FitCloudInvoice.fromJson(_invoice('4', 'VOID', '60')),
        FitCloudInvoice.fromJson(_invoice('5', 'OPEN', '10', currency: 'USD')),
      ]);
      expect(t.currency, 'INR');
      expect(t.totalInvoiced, 1400);
      expect(t.outstanding, 400);
      expect(t.openCount, 1);
      expect(t.counts['ALL'], 5);
      expect(t.counts['OPEN'], 2);
    });
  });

  group('formatting', () {
    test('billingMoney uses the plan currency, grouping and decimals', () {
      expect(billingMoney(1499, 'INR'), '₹1,499');
      expect(billingMoney(1234567, 'INR'), '₹12,34,567');
      expect(billingMoney(1234567.5, 'USD', decimals: 2), r'$1,234,567.50');
      expect(billingMoney(99, 'XYZ'), 'XYZ 99');
      expect(billingMoney(-50, 'INR', decimals: 2), '-₹50.00');
    });

    test('billingCompact', () {
      expect(billingCompact(950, 'INR'), '₹950');
      expect(billingCompact(13000, 'INR'), '₹13k');
      expect(billingCompact(410000, 'INR'), '₹4.10L');
      expect(billingCompact(2500000, 'USD'), r'$2.5M');
    });

    test('period progress: days left (ceil), percent used, no end', () {
      final start = DateTime.utc(2026, 10, 1);
      final end = DateTime.utc(2026, 10, 31);
      final p = billingPeriodProgress(
        start: start,
        end: end,
        now: DateTime.utc(2026, 10, 16),
      )!;
      expect(p.daysLeft, 15);
      expect(p.elapsedPct, 50);
      final over = billingPeriodProgress(
        start: start,
        end: end,
        now: DateTime.utc(2026, 12, 1),
      )!;
      expect(over.daysLeft, 0);
      expect(over.elapsedPct, 100);
      expect(billingPeriodProgress(start: start, end: null), isNull);
    });

    test('status colours follow web tones', () {
      expect(billingStatusColor('PAID'), billingStatusColor('ACTIVE'));
      expect(billingStatusColor('OPEN'), billingStatusColor('PENDING'));
      expect(billingStatusColor('VOID'), billingStatusColor('CANCELED'));
      expect(billingStatusColor('FAILED'), isNot(billingStatusColor('PAID')));
    });
  });
}
