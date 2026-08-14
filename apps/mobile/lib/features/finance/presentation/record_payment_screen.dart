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
import '../../../models/payment_link_result.dart';
import '../../../repositories/finance_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';

enum _Channel { offline, link }

/// Design frame "6. Record payment" + "7a. Recorded" confirmation, plus the
/// "Send payment link" channel (frame "6a. Send payment link") — an online
/// Razorpay Payment Link the member pays themselves, instead of an
/// offline/cash-style record.
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
  _Channel _channel = _Channel.offline;
  bool _notifyEmail = true;
  bool _notifySms = true;
  bool _submitting = false;
  String? _error;
  MemberPayment? _recorded;
  PaymentLinkResult? _linkResult;

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
      if (_channel == _Channel.link) {
        final result = await getIt<FinanceRepository>().createPaymentLink(
          memberId: member.id,
          amount: amount,
          notifyEmail: _notifyEmail,
          notifySms: _notifySms,
        );
        if (!mounted) return;
        setState(() => _linkResult = result);
      } else {
        final result = await getIt<FinanceRepository>().recordPayment(
          memberId: member.id,
          amount: amount,
          method: _method.apiValue,
        );
        if (!mounted) return;
        setState(() => _recorded = result);
      }
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
        child: _recorded != null
            ? _buildConfirmation(_recorded!)
            : _linkResult != null
                ? _buildLinkSent(_linkResult!)
                : _buildForm(),
      ),
    );
  }

  Widget _buildForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _ChannelChip(
                  label: 'Offline / mark as paid',
                  selected: _channel == _Channel.offline,
                  onTap: () => setState(() => _channel = _Channel.offline),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _ChannelChip(
                  label: 'Send payment link',
                  selected: _channel == _Channel.link,
                  onTap: () => setState(() => _channel = _Channel.link),
                ),
              ),
            ],
          ),
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
          if (_channel == _Channel.offline) ...[
            Text('Method', style: AppText.eyebrow()),
            const SizedBox(height: 8),
            CategoryChipSelector<PaymentMethod>(
              options: PaymentMethod.values,
              labelOf: (m) => m.label,
              value: _method,
              onChanged: (m) => setState(() => _method = m),
            ),
          ] else ...[
            _NotifyToggle(
              label: 'Notify by email',
              value: _notifyEmail,
              onChanged: (v) => setState(() => _notifyEmail = v),
            ),
            const SizedBox(height: 8),
            _NotifyToggle(
              label: 'Notify by SMS',
              value: _notifySms,
              onChanged: (v) => setState(() => _notifySms = v),
            ),
          ],
          const SizedBox(height: 24),
          AppButton(
            label: _channel == _Channel.offline
                ? 'Record payment'
                : 'Send link',
            loading: _submitting,
            onPressed: _submit,
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildLinkSent(PaymentLinkResult result) {
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
              colors: [Color(0x298B5CF6), Color(0x14FF6B5B)],
            ),
            child: Column(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: const BoxDecoration(
                    color: AppColors.staffB,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.link_rounded,
                    color: Colors.white,
                    size: 28,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  Formatters.currency(result.payment.finalAmount),
                  style: AppText.display(size: 24),
                ),
                const SizedBox(height: 4),
                Text(
                  'Link sent · ${_selectedMember?.name ?? ''}',
                  style: AppText.body(color: AppColors.inkFaint),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AppCard(
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    result.shortUrl,
                    style: AppText.body(size: 12, weight: FontWeight.w700),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.copy_rounded, size: 18),
                  color: AppColors.inkFaint,
                  onPressed: () => Clipboard.setData(
                    ClipboardData(text: result.shortUrl),
                  ),
                ),
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

class _ChannelChip extends StatelessWidget {
  const _ChannelChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          gradient: selected ? AppColors.staffGrad : null,
          color: selected ? null : AppColors.surface3,
          borderRadius: BorderRadius.circular(999),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: AppText.body(
            size: 11,
            weight: FontWeight.w700,
            color: selected ? Colors.white : AppColors.inkSoft,
          ),
        ),
      ),
    );
  }
}

class _NotifyToggle extends StatelessWidget {
  const _NotifyToggle({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: AppText.body(size: 13, weight: FontWeight.w700),
          ),
        ),
        GestureDetector(
          onTap: () => onChanged(!value),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            width: 44,
            height: 26,
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              gradient: value ? AppColors.staffGrad : null,
              color: value ? null : AppColors.surface3,
              borderRadius: BorderRadius.circular(99),
            ),
            alignment: value ? Alignment.centerRight : Alignment.centerLeft,
            child: Container(
              width: 20,
              height: 20,
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
            ),
          ),
        ),
      ],
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
