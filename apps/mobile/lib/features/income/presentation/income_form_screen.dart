import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/income_entry.dart';
import '../../../repositories/income_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'income_ui.dart';

/// "Add income" — web's `AddIncomeDialog` as a page (pushed from the list's
/// "+" for `finance:income-manage` holders; pops `true` after a save).
///
/// Same fields, order and rules as web: Category (chips, default Membership
/// Fee), Amount (> 0, "Enter a valid amount."), Date (default today; the date
/// picker has never allowed the future here, which is kept), Description
/// (optional, max 2000). Payload = `{category, amount, incomeDate:
/// YYYY-MM-DD, description?}`. There is no edit screen: web can only create
/// and delete income entries.
class IncomeFormScreen extends StatefulWidget {
  const IncomeFormScreen({super.key});

  @override
  State<IncomeFormScreen> createState() => _IncomeFormScreenState();
}

class _IncomeFormScreenState extends State<IncomeFormScreen> {
  final _descriptionController = TextEditingController();
  final _amountController = TextEditingController();
  IncomeCategory _category = IncomeCategory.membershipFee;
  DateTime _date = DateTime.now();
  bool _loading = false;
  String? _error;
  String? _amountError;

  @override
  void dispose() {
    _descriptionController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_loading) return;
    final amount = double.tryParse(_amountController.text.trim());
    if (amount == null || amount <= 0) {
      setState(() {
        _amountError = 'Enter a valid amount.';
        _error = null;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _amountError = null;
    });
    try {
      await getIt<IncomeRepository>().create(
        category: _category,
        amount: amount,
        incomeDate: _date,
        description: _descriptionController.text.trim(),
      );
      if (!mounted) return;
      context.pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not save the entry ($e)');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('New Income'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Hero(top: top),
            TeamCenter(
              maxWidth: 760,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_error != null) ...[
                      FormAlert(message: _error!),
                      const SizedBox(height: 14),
                    ],
                    TeamFormSection(
                      icon: Icons.category_rounded,
                      color: TeamColors.indigo,
                      title: 'Category',
                      children: [
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final c in IncomeCategory.values)
                              IncomeCategoryChip(
                                label: c.webLabel,
                                color: incomeCategoryColor(c),
                                selected: _category == c,
                                enabled: !_loading,
                                onTap: () => setState(() => _category = c),
                              ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    TeamFormSection(
                      icon: Icons.payments_rounded,
                      color: TeamColors.green,
                      title: 'Amount & date',
                      children: [
                        AppLabeledField(
                          label: 'Amount',
                          hintText: 'e.g. 2500',
                          icon: Icons.payments_rounded,
                          iconColor: TeamColors.green,
                          controller: _amountController,
                          errorText: _amountError,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(
                              RegExp(r'^\d*\.?\d{0,2}'),
                            ),
                          ],
                          textInputAction: TextInputAction.next,
                          onChanged: (_) {
                            if (_amountError != null) {
                              setState(() => _amountError = null);
                            }
                          },
                        ),
                        TeamDateField(
                          label: 'Date',
                          icon: Icons.event_rounded,
                          iconColor: TeamColors.violet,
                          value: _date,
                          clearable: false,
                          firstDate: DateTime(2020),
                          lastDate: DateTime.now(),
                          onChanged: (d) {
                            if (d != null) setState(() => _date = d);
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    TeamFormSection(
                      icon: Icons.notes_rounded,
                      color: TeamColors.amber,
                      title: 'Description',
                      subtitle: 'Optional',
                      children: [
                        AppLabeledField(
                          label: 'Description',
                          hintText: 'What is this income for? (optional)',
                          controller: _descriptionController,
                          minLines: 3,
                          maxLines: 6,
                          inputFormatters: [
                            LengthLimitingTextInputFormatter(2000),
                          ],
                          textCapitalization: TextCapitalization.sentences,
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    TeamGradientButton(
                      label: 'Add income',
                      icon: Icons.check_rounded,
                      loading: _loading,
                      onTap: _submit,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Full-width gradient header under the transparent app bar.
class _Hero extends StatelessWidget {
  const _Hero({required this.top});

  final double top;

  @override
  Widget build(BuildContext context) {
    return MeshHeroBackground(
      radius: const BorderRadius.vertical(bottom: Radius.circular(30)),
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          18 + teamSideInset(context),
          top + 4,
          18 + teamSideInset(context),
          22,
        ),
        child: Row(
          children: [
            Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
              ),
              child: const Icon(
                Icons.payments_rounded,
                color: Colors.white,
                size: 28,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Add income',
                    style: AppText.display(size: 22, color: Colors.white),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Record a manual entry in the revenue ledger',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const TeamHeroPill(
                    'Finance · Income',
                    icon: Icons.account_balance_wallet_rounded,
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
