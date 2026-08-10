import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/member_payment.dart';
import '../../../models/member_summary.dart';
import '../../../repositories/finance_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';

/// Design frame "6. Record payment" + "7a. Recorded" confirmation.
class RecordPaymentScreen extends StatefulWidget {
  const RecordPaymentScreen({super.key});

  @override
  State<RecordPaymentScreen> createState() => _RecordPaymentScreenState();
}

class _RecordPaymentScreenState extends State<RecordPaymentScreen> {
  final _searchController = TextEditingController();
  final _amountController = TextEditingController();
  Timer? _debounce;
  List<MemberSummary> _results = [];
  bool _searching = false;
  MemberSummary? _selectedMember;
  PaymentMethod _method = PaymentMethod.upi;
  bool _submitting = false;
  String? _error;
  MemberPayment? _recorded;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    setState(() => _selectedMember = null);
    _debounce?.cancel();
    if (query.trim().isEmpty) {
      setState(() => _results = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      setState(() => _searching = true);
      try {
        final results = await getIt<FinanceRepository>().searchMembers(query);
        if (!mounted) return;
        setState(() => _results = results);
      } on ApiException {
        // Search failures fail quiet — the field just shows no results, not a blocking error.
      } finally {
        if (mounted) setState(() => _searching = false);
      }
    });
  }

  void _selectMember(MemberSummary member) {
    setState(() {
      _selectedMember = member;
      _results = [];
      _searchController.text = '${member.name} · ${member.memberId}';
    });
  }

  Future<void> _submit() async {
    final member = _selectedMember;
    final amount = double.tryParse(_amountController.text.trim());
    if (member == null) {
      setState(() => _error = 'Search and select a member first');
      return;
    }
    if (amount == null || amount <= 0) {
      setState(() => _error = 'Enter a valid amount');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final result = await getIt<FinanceRepository>().recordPayment(
        memberId: member.id,
        amount: amount,
        method: _method.apiValue,
      );
      if (!mounted) return;
      setState(() => _recorded = result);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: const Text('Record Payment'),
      ),
      body: SafeArea(
        top: false,
        child:
            _recorded != null ? _buildConfirmation(_recorded!) : _buildForm(),
      ),
    );
  }

  Widget _buildForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_error != null) ...[
            const SizedBox(height: 8),
            FormAlert(message: _error!),
          ],
          const SizedBox(height: 16),
          Text('Member', style: AppText.eyebrow()),
          const SizedBox(height: 6),
          Container(
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(AppRadii.field),
              border: Border.all(color: AppColors.line),
            ),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              style: AppText.body(size: 15, weight: FontWeight.w600),
              cursorColor: AppColors.memberB,
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                hintText: 'Search by name or member ID…',
                hintStyle: AppText.body(size: 14, color: AppColors.inkFaint),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                suffixIcon: _searching
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : null,
              ),
            ),
          ),
          if (_results.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 8),
              decoration: BoxDecoration(
                color: AppColors.surface2,
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                children: _results.map((m) {
                  return ListTile(
                    onTap: () => _selectMember(m),
                    leading: CircleAvatar(
                      backgroundColor: AppColors.staffSoft,
                      child: Text(
                        m.initials,
                        style: AppText.body(
                          size: 11,
                          weight: FontWeight.w800,
                          color: AppColors.staffPillFg,
                        ),
                      ),
                    ),
                    title: Text(
                      m.name,
                      style: AppText.body(size: 13, weight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      m.memberId,
                      style: AppText.body(size: 11, color: AppColors.inkFaint),
                    ),
                  );
                }).toList(),
              ),
            ),
          const SizedBox(height: 14),
          Text('Amount', style: AppText.eyebrow()),
          const SizedBox(height: 6),
          Container(
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(AppRadii.field),
              border: Border.all(color: AppColors.line),
            ),
            child: TextField(
              controller: _amountController,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
              ],
              style: AppText.body(size: 15, weight: FontWeight.w600),
              cursorColor: AppColors.memberB,
              decoration: const InputDecoration(
                isDense: true,
                border: InputBorder.none,
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 14, vertical: 13),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text('Method', style: AppText.eyebrow()),
          const SizedBox(height: 8),
          CategoryChipSelector<PaymentMethod>(
            options: PaymentMethod.values,
            labelOf: (m) => m.label,
            value: _method,
            onChanged: (m) => setState(() => _method = m),
          ),
          const SizedBox(height: 24),
          AppButton(
            label: 'Record payment',
            loading: _submitting,
            onPressed: _submit,
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildConfirmation(MemberPayment payment) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: Column(
        children: [
          const SizedBox(height: 24),
          GlassCard(
            padding: const EdgeInsets.all(28),
            gradientOverlay: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0x2E3DDC84), Color(0x0F14E0B4)],
            ),
            child: Column(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: const BoxDecoration(
                    color: AppColors.success,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.check_rounded,
                    color: Color(0xFF0B231D),
                    size: 30,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  Formatters.currency(payment.finalAmount),
                  style: AppText.display(size: 24),
                ),
                const SizedBox(height: 4),
                Text(
                  'Payment recorded · ${_selectedMember?.name ?? ''}',
                  style: AppText.body(color: AppColors.inkFaint),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AppCard(
            child: Column(
              children: [
                _ConfirmRow(label: 'Payment #', value: payment.paymentNumber),
                _ConfirmRow(label: 'Status', value: payment.status),
              ],
            ),
          ),
          const SizedBox(height: 24),
          AppButton(label: 'Done', onPressed: () => context.pop()),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _ConfirmRow extends StatelessWidget {
  const _ConfirmRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppText.body(
              size: 13,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          Text(value, style: AppText.body(size: 13, weight: FontWeight.w700)),
        ],
      ),
    );
  }
}
