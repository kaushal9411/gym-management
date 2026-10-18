import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/profile_photo.dart';
import '../../../models/expense_entry.dart';
import '../../../repositories/expense_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../income/presentation/income_ui.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'expense_ui.dart';

/// "Add an expense" — web's `/expenses/new` page.
///
/// Same fields, order and rules as web: Category (chips, default Rent),
/// Amount (> 0, "Enter a valid amount."), Date (default today; the date picker
/// has never allowed the future here, which is kept), Description (optional,
/// max 2000) and the optional Receipt, then web's live Summary (category,
/// date, receipt, gradient amount) with the submit button. Payload =
/// `{category, amount, expenseDate: YYYY-MM-DD, description?, receiptFileName?,
/// receiptDataUrl?}`. Pushed from the list's "+" for `finance:expense-manage`
/// holders; pops `true` after a save. There is no edit screen: web can only
/// create and delete expenses.
///
/// **Receipt**: web takes an image or a PDF; the app has no general file
/// picker (only `image_picker`), so a receipt here is a photo — taken with the
/// camera or chosen from the gallery — sent as a base64 `data:` URL. The API's
/// 1 MB request cap applies (the helper refuses anything larger with a clear
/// message). PDFs can't be attached from the phone.
class ExpenseFormScreen extends StatefulWidget {
  const ExpenseFormScreen({super.key});

  @override
  State<ExpenseFormScreen> createState() => _ExpenseFormScreenState();
}

class _ExpenseFormScreenState extends State<ExpenseFormScreen> {
  final _descriptionController = TextEditingController();
  final _amountController = TextEditingController();
  ExpenseCategory _category = ExpenseCategory.rent;
  DateTime _date = DateTime.now();
  String? _receiptName;
  String? _receiptDataUrl;
  Uint8List? _receiptBytes;
  bool _picking = false;
  bool _loading = false;
  String? _error;
  String? _amountError;

  @override
  void initState() {
    super.initState();
    _amountController.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  double get _amount => double.tryParse(_amountController.text.trim()) ?? 0;

  Future<void> _pickReceipt() async {
    if (_picking || _loading) return;
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: AppColors.surface2,
      constraints: const BoxConstraints(maxWidth: 640),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Take a photo'),
              onTap: () => Navigator.pop(sheetContext, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose from gallery'),
              onTap: () => Navigator.pop(sheetContext, ImageSource.gallery),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (source == null || !mounted) return;
    setState(() => _picking = true);
    try {
      final picked = await ImagePicker().pickImage(
        source: source,
        maxWidth: 1280,
        maxHeight: 1280,
        imageQuality: 80,
      );
      if (picked == null) return;
      final bytes = await picked.readAsBytes();
      final url = buildPhotoDataUrl(bytes);
      if (!mounted) return;
      setState(() {
        _receiptName = picked.name.isEmpty ? 'receipt.jpg' : picked.name;
        _receiptDataUrl = url;
        _receiptBytes = bytes;
      });
    } on ProfilePhotoException catch (e) {
      if (mounted) teamSnack(context, e.message, error: true);
    } catch (e) {
      if (mounted) {
        teamSnack(context, "Couldn't read that file ($e)", error: true);
      }
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  void _removeReceipt() => setState(() {
        _receiptName = null;
        _receiptDataUrl = null;
        _receiptBytes = null;
      });

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
      await getIt<ExpenseRepository>().create(
        category: _category,
        amount: amount,
        expenseDate: _date,
        description: _descriptionController.text.trim(),
        receiptFileName: _receiptName,
        receiptDataUrl: _receiptDataUrl,
      );
      if (!mounted) return;
      context.pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not save the expense ($e)');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final wide = MediaQuery.sizeOf(context).width >= 900;
    final details = _details();
    final summary = _summary();
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('New Expense'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Hero(top: top),
            TeamCenter(
              maxWidth: wide ? 1100 : 760,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_error != null) ...[
                      FormAlert(message: _error!),
                      const SizedBox(height: 14),
                    ],
                    if (wide)
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(flex: 3, child: details),
                          const SizedBox(width: 16),
                          Expanded(flex: 2, child: summary),
                        ],
                      )
                    else ...[
                      details,
                      const SizedBox(height: 14),
                      summary,
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Web's step 1 "Expense details": category, amount, date, description,
  /// receipt.
  Widget _details() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TeamFormSection(
          icon: Icons.category_rounded,
          color: TeamColors.rose,
          title: 'Category',
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final c in ExpenseCategory.values)
                  IncomeCategoryChip(
                    label: c.label,
                    color: expenseCategoryColor(c),
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
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
              ],
              textInputAction: TextInputAction.next,
              onChanged: (_) {
                if (_amountError != null) setState(() => _amountError = null);
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
              hintText: 'e.g. Monthly electricity bill',
              controller: _descriptionController,
              minLines: 3,
              maxLines: 6,
              inputFormatters: [LengthLimitingTextInputFormatter(2000)],
              textCapitalization: TextCapitalization.sentences,
            ),
          ],
        ),
        const SizedBox(height: 14),
        TeamSectionCard(
          icon: Icons.attach_file_rounded,
          color: TeamColors.teal,
          title: 'Receipt',
          subtitle: 'Optional · a photo, up to about 1 MB',
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: _receiptPicker(),
          ),
        ),
      ],
    );
  }

  Widget _receiptPicker() {
    final name = _receiptName;
    if (name != null) {
      return Container(
        key: const ValueKey('expense-receipt-attached'),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.surface3,
          borderRadius: BorderRadius.circular(AppRadii.card),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: _receiptBytes == null
                  ? Container(
                      width: 44,
                      height: 44,
                      color: TeamColors.teal.withValues(alpha: 0.15),
                      child: const Icon(
                        Icons.description_rounded,
                        color: TeamColors.teal,
                      ),
                    )
                  : Image.memory(
                      _receiptBytes!,
                      width: 44,
                      height: 44,
                      fit: BoxFit.cover,
                    ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(size: 13, weight: FontWeight.w700),
              ),
            ),
            TextButton(
              onPressed: _loading ? null : _removeReceipt,
              child: const Text('Remove'),
            ),
          ],
        ),
      );
    }
    return GestureDetector(
      key: const ValueKey('expense-receipt-pick'),
      onTap: _pickReceipt,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: AppColors.line, width: 1.4),
        ),
        child: Column(
          children: [
            Icon(Icons.upload_rounded, size: 22, color: AppColors.inkSoft),
            const SizedBox(height: 6),
            Text(
              _picking ? 'Uploading…' : 'Upload receipt',
              style: AppText.body(size: 13, weight: FontWeight.w800),
            ),
            const SizedBox(height: 2),
            Text(
              'Take a photo or choose an image',
              style: AppText.body(
                size: 11.5,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Web's `ExpenseSummaryCard`: rows + gradient amount + submit.
  Widget _summary() {
    Widget row(String label, Widget value, {bool first = false}) => Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            border: first
                ? null
                : Border(top: BorderSide(color: AppColors.line, width: 1)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: AppText.body(
                  size: 13,
                  weight: FontWeight.w700,
                  color: AppColors.inkSoft,
                ),
              ),
              const SizedBox(width: 12),
              Flexible(child: value),
            ],
          ),
        );
    final valueStyle = AppText.body(size: 13, weight: FontWeight.w700);
    return TeamSectionCard(
      icon: Icons.receipt_long_rounded,
      color: TeamColors.violet,
      title: 'Summary',
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            row(
              'Category',
              Align(
                alignment: Alignment.centerRight,
                child: IncomeTag(
                  label: _category.label,
                  color: expenseCategoryColor(_category),
                ),
              ),
              first: true,
            ),
            row(
              'Date',
              Text(
                incomeDay(_date),
                textAlign: TextAlign.right,
                style: valueStyle,
              ),
            ),
            row(
              'Receipt',
              Text(
                _receiptName == null
                    ? 'None attached'
                    : 'Attached · $_receiptName',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.right,
                style: valueStyle,
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                gradient: TeamColors.cta,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Row(
                children: [
                  Text(
                    'Amount',
                    style: AppText.body(
                      size: 14,
                      weight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                  const Spacer(),
                  Flexible(
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        money(_amount),
                        key: const ValueKey('expense-summary-amount'),
                        style: AppText.display(size: 24, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            TeamGradientButton(
              label: 'Add expense',
              icon: Icons.check_rounded,
              loading: _loading,
              onTap: _submit,
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: _loading ? null : () => context.pop(),
              child: const Text('Cancel'),
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
                Icons.receipt_long_rounded,
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
                    'Add an expense',
                    style: AppText.display(size: 22, color: Colors.white),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Log rent, salaries, utilities or any other cost — attach '
                    'the receipt so the books stay audit-ready.',
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const TeamHeroPill(
                    'Finance · New',
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
