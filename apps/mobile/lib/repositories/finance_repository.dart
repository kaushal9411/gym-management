import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/finance_summary.dart';
import '../models/member_payment.dart';
import '../models/member_summary.dart';
import '../models/payment_link_result.dart';

class FinanceRepository {
  FinanceRepository(this._dio);

  final Dio _dio;

  Future<FinanceSummary> summary() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/finance/summary');
      return FinanceSummary.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Narrow bridge into `/members?search=` for the Record Payment member
  /// picker — see `MemberSummary`'s doc comment for why this isn't a full
  /// members repository.
  Future<List<MemberSummary>> searchMembers(String query) async {
    if (query.trim().isEmpty) return [];
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/members',
        queryParameters: {'search': query.trim(), 'page': 1, 'limit': 10},
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      final items = data['items'] as List;
      return items
          .map((e) => MemberSummary.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<MemberPayment> recordPayment({
    required String memberId,
    required double amount,
    required String method,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/payments',
        data: {'memberId': memberId, 'amount': amount, 'method': method},
      );
      return MemberPayment.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// `POST /payments/razorpay/link` — staff never handle card details; the
  /// payment row is created PENDING and the member pays via `shortUrl`.
  Future<PaymentLinkResult> createPaymentLink({
    required String memberId,
    required double amount,
    bool? notifyEmail,
    bool? notifySms,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/payments/razorpay/link',
        data: {
          'memberId': memberId,
          'amount': amount,
          if (notifyEmail != null) 'notifyEmail': notifyEmail,
          if (notifySms != null) 'notifySms': notifySms,
        },
      );
      return PaymentLinkResult.fromJson(
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
