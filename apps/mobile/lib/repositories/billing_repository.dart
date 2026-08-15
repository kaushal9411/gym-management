import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/billing_address.dart';
import '../models/checkout_result.dart';
import '../models/fitcloud_invoice.dart';
import '../models/subscription_plan_info.dart';
import '../models/subscription_plan_option.dart';

class BillingRepository {
  BillingRepository(this._dio);

  final Dio _dio;

  /// Null when the tenant has no subscription row at all (404 `NOT_FOUND`) —
  /// a real, non-error state for tenants provisioned outside onboarding.
  Future<TenantSubscription?> currentSubscription() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/subscription');
      return TenantSubscription.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      throw _mapError(e);
    }
  }

  /// Every plan a tenant can choose or switch to — the same list the
  /// onboarding wizard's plan-selection step already used, reused here for
  /// "Change plan".
  Future<List<SubscriptionPlanOption>> listPlans() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/onboarding/plans');
      final list = response.data!['data'] as List;
      return list
          .map(
            (e) => SubscriptionPlanOption.fromJson(e as Map<String, dynamic>),
          )
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Choose plan → coupon → tax (server-side) → real Razorpay Order →
  /// invoice → activate — mirrors web's `CheckoutDialog`. [kind] is
  /// `create` (no subscription yet), `upgrade`, or `downgrade`; only
  /// `create` hits a different path (`POST /subscription` vs
  /// `POST /subscription/:kind`). A free/fully-discounted result activates
  /// immediately; anything with a balance due returns a real Razorpay
  /// Order for the native Checkout modal (`razorpay_flutter`) — this app
  /// never collects card/UPI details itself. Call [verifyCheckout] with
  /// the modal's signed success callback once the tenant has paid.
  Future<CheckoutResult> checkout({
    required String kind,
    required String planSlug,
    required String billingCycle,
    String? couponCode,
  }) async {
    try {
      final path = kind == 'create' ? '/subscription' : '/subscription/$kind';
      final response = await _dio.post<Map<String, dynamic>>(
        path,
        data: {
          'planSlug': planSlug,
          'billingCycle': billingCycle,
          if (couponCode != null && couponCode.isNotEmpty)
            'couponCode': couponCode,
        },
        options: Options(
          headers: {
            'Idempotency-Key':
                '${DateTime.now().microsecondsSinceEpoch}-${identityHashCode(this)}',
          },
        ),
      );
      return CheckoutResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Called once the Razorpay Checkout modal's success callback fires,
  /// with the signed order/payment pair it returned — the backend verifies
  /// the signature (HMAC of orderId|paymentId) before activating anything.
  Future<VerifyCheckoutResult> verifyCheckout({
    required String paymentId,
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/subscription/checkout/$paymentId/verify',
        data: {
          'razorpayOrderId': razorpayOrderId,
          'razorpayPaymentId': razorpayPaymentId,
          'razorpaySignature': razorpaySignature,
        },
      );
      return VerifyCheckoutResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `finalAmount` is the only field the checkout sheet actually shows
  /// (the "after coupon" price) — mirrors web's `CheckoutDialog`.
  Future<double> validateCoupon(String code, double amount) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/coupon/validate',
        data: {'code': code, 'amount': amount},
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      return (data['finalAmount'] as num).toDouble();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<List<FitCloudInvoice>> invoices() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/invoice');
      final list = response.data!['data'] as List;
      return list
          .map((e) => FitCloudInvoice.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Null when the tenant hasn't set one yet — the endpoint itself returns
  /// `data: null` for this case (not a 404), verified live.
  Future<BillingAddress?> getAddress() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/billing/address');
      final data = response.data!['data'];
      return data == null
          ? null
          : BillingAddress.fromJson(data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Creates or replaces the tenant's billing address in one call — the
  /// endpoint is a full upsert, not a partial PATCH.
  Future<BillingAddress> saveAddress({
    String? legalName,
    required String line1,
    String? line2,
    required String city,
    required String state,
    required String postalCode,
    required String country,
    String? taxId,
  }) async {
    try {
      final response = await _dio.put<Map<String, dynamic>>(
        '/billing/address',
        data: {
          if (legalName != null && legalName.isNotEmpty) 'legalName': legalName,
          'line1': line1,
          if (line2 != null && line2.isNotEmpty) 'line2': line2,
          'city': city,
          'state': state,
          'postalCode': postalCode,
          'country': country.toUpperCase(),
          if (taxId != null && taxId.isNotEmpty) 'taxId': taxId,
        },
      );
      return BillingAddress.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  ApiException _mapError(DioException e) {
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout) {
      return ApiException.network();
    }
    return ApiException.fromResponseData(
      e.response?.data,
      e.response?.statusCode,
    );
  }
}
