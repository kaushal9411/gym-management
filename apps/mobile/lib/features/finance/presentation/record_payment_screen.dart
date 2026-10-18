import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/app_currency.dart';
import '../../../models/member_payment.dart';
import '../../../models/member_summary.dart';
import '../../../models/payable_invoice.dart';
import '../../../models/payment_link_result.dart';
import '../../../repositories/finance_repository.dart';
import '../../../repositories/payment_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../../shared/widgets/slide_drawer_scaffold.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'payment_actions.dart';
import 'payments_ui.dart';

enum _Channel { offline, link }

final _money = [FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}'))];

/// Web's `/payments/new` — "Record a payment" — as one scrolling page in the
/// Members / Classes design language. Used in three places, none of which
/// changed: the Receptionist shell's **Payments** tab (no gate, as before),
/// and the pushed `AppRoutes.recordPayment` route from the Owner Finance tab
/// and the Owner dashboard hero.
///
/// Same steps as web: **1 Member** (search + snapshot with outstanding / last
/// payment), **2 Invoice (optional)** (the member's UNPAID / PARTIALLY_PAID
/// invoices — picking one prefills the amount with what is still due and
/// offers Full invoice / Half; needs `finance:invoice-view`, otherwise the
/// step is simply absent), **3 How is it being paid** — *Collected now*
/// (method chips, amount, discount, tax, date, reference, notes) or *Send
/// payment link* (amount, discount, tax, notes, email / SMS switches), then
/// the summary (amount − discount + tax, invoice note) and the submit button.
/// A generated link shows web's panel: copy, status badge, **Check payment
/// status**, **Resend by email / SMS**, **Send a different link**. Recorded
/// payments keep the confirmation page (plus View payment, which needs
/// `finance:view`).
///
/// Money handling is the old behaviour: `FinanceRepository.recordPayment` /
/// `createPaymentLink` with the same arithmetic as the server (final =
/// amount − discount + tax). The payment date is only sent when the user
/// moves it off today; no `membershipId` is sent (as before). The email / SMS
/// switches default to ON only when the member has that contact (the server
/// rejects a link whose switch is on without a contact).
///
/// **Dropped vs web**: nothing with an endpoint. (The Receptionist tab keeps
/// its `IndexedStack` instance, so a finished form shows the confirmation until
/// "Record another".)
class RecordPaymentScreen extends StatefulWidget {
  const RecordPaymentScreen({super.key});

  @override
  State<RecordPaymentScreen> createState() => _RecordPaymentScreenState();
}

class _RecordPaymentScreenState extends State<RecordPaymentScreen> {
  final _searchController = TextEditingController();
  final _amount = TextEditingController();
  final _discount = TextEditingController();
  final _tax = TextEditingController();
  final _reference = TextEditingController();
  final _notes = TextEditingController();
  Timer? _debounce;

  List<MemberSummary> _results = [];
  bool _searching = false;
  MemberSummary? _member;
  MemberPayment? _lastPayment;
  List<MemberPayment>? _recent;

  List<PayableInvoice>? _invoices;
  String _invoiceId = '';
  InvoiceDue? _due;

  PaymentMethod _method = PaymentMethod.upi;
  DateTime _date = _today();
  bool _dateTouched = false;
  _Channel _channel = _Channel.offline;
  bool _notifyEmail = false;
  bool _notifySms = false;

  bool _submitting = false;
  String? _error;
  MemberPayment? _recorded;
  PaymentLinkResult? _linkResult;
  String? _linkStatus; // PENDING | SUCCESS | FAILED
  bool _checking = false;
  String? _resending; // 'email' | 'sms'

  static DateTime _today() {
    final n = DateTime.now();
    return DateTime(n.year, n.month, n.day);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _amount.dispose();
    _discount.dispose();
    _tax.dispose();
    _reference.dispose();
    _notes.dispose();
    super.dispose();
  }

  // ── derived ───────────────────────────────────────────────────────────────

  double get _amountValue => double.tryParse(_amount.text.trim()) ?? 0;
  double get _discountValue => double.tryParse(_discount.text.trim()) ?? 0;
  double get _taxValue => double.tryParse(_tax.text.trim()) ?? 0;

  /// Same arithmetic as web and the server: amount − discount + tax, never
  /// below zero.
  double get _finalAmount {
    final v = _amountValue - _discountValue + _taxValue;
    return v < 0 ? 0 : v;
  }

  bool get _canInvoice => teamCan(context, PayPerm.invoiceView);

  // ── member ────────────────────────────────────────────────────────────────

  void _onSearchChanged(String query) {
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
        // Search failures fail quiet — the field just shows no results.
      } catch (_) {
        // Same: never block the form on the picker.
      } finally {
        if (mounted) setState(() => _searching = false);
      }
    });
  }

  void _selectMember(MemberSummary m) {
    setState(() {
      _member = m;
      _results = [];
      _searchController.clear();
      _lastPayment = null;
      _recent = null;
      _invoices = null;
      _invoiceId = '';
      _due = null;
      // Notify switches follow the contacts the member actually has (the
      // server refuses a link with a switch on and no email / phone).
      _notifyEmail = m.hasEmail;
      _notifySms = m.hasPhone;
      _error = null;
    });
    unawaited(_loadMemberExtras(m));
  }

  void _clearMember() {
    setState(() {
      _member = null;
      _lastPayment = null;
      _recent = null;
      _invoices = null;
      _invoiceId = '';
      _due = null;
      _notifyEmail = false;
      _notifySms = false;
    });
  }

  Future<void> _loadMemberExtras(MemberSummary m) async {
    final repo = getIt<PaymentRepository>();
    try {
      final last = await repo.list(
        memberId: m.id,
        status: 'SUCCESS',
        limit: 1,
      );
      if (mounted && _member?.id == m.id) {
        setState(() => _lastPayment = last.items.firstOrNull);
      }
    } catch (_) {
      // Snapshot garnish — the form works without it.
    }
    try {
      final recent = await repo.list(memberId: m.id, limit: 4);
      if (mounted && _member?.id == m.id) {
        setState(() => _recent = recent.items);
      }
    } catch (_) {
      if (mounted && _member?.id == m.id) setState(() => _recent = const []);
    }
    if (!_canInvoice) return;
    try {
      final invoices = await repo.outstandingInvoices(m.id);
      if (mounted && _member?.id == m.id) {
        setState(() => _invoices = invoices);
      }
    } catch (_) {
      // No `finance:invoice-view` (403) or a network blip: just no invoices.
      if (mounted && _member?.id == m.id) setState(() => _invoices = const []);
    }
  }

  Future<void> _selectInvoice(String id) async {
    setState(() {
      _invoiceId = id;
      _due = null;
    });
    if (id.isEmpty) return;
    try {
      final due = await getIt<PaymentRepository>().invoiceDue(id);
      if (!mounted || _invoiceId != id) return;
      setState(() {
        _due = due;
        _amount.text = due.due.toStringAsFixed(2);
      });
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) {
        teamSnack(context, 'Could not load the invoice ($e)', error: true);
      }
    }
  }

  // ── submit ────────────────────────────────────────────────────────────────

  bool _validate() {
    if (_member == null) {
      setState(() => _error = 'Select a member first.');
      return false;
    }
    if (_amountValue <= 0) {
      setState(() => _error = 'Enter a valid amount.');
      return false;
    }
    return true;
  }

  Future<void> _submit() async {
    if (_submitting || !_validate()) return;
    final member = _member!;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final repo = getIt<FinanceRepository>();
      if (_channel == _Channel.link) {
        final result = await repo.createPaymentLink(
          memberId: member.id,
          amount: _amountValue,
          notifyEmail: _notifyEmail && member.hasEmail,
          notifySms: _notifySms && member.hasPhone,
          invoiceId: _invoiceId.isEmpty ? null : _invoiceId,
          discount: _discountValue,
          tax: _taxValue,
          notes: _notes.text.trim(),
        );
        if (!mounted) return;
        setState(() {
          _linkResult = result;
          _linkStatus = 'PENDING';
        });
        teamSnack(context, 'Payment link generated.');
      } else {
        final result = await repo.recordPayment(
          memberId: member.id,
          amount: _amountValue,
          method: _method.apiValue,
          discount: _discountValue,
          tax: _taxValue,
          invoiceId: _invoiceId.isEmpty ? null : _invoiceId,
          paymentDate: _dateTouched ? payIso(_date) : null,
          transactionReference: _reference.text.trim(),
          notes: _notes.text.trim(),
        );
        if (!mounted) return;
        setState(() => _recorded = result);
        teamSnack(context, 'Payment ${result.paymentNumber} recorded.');
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Something went wrong ($e). Please try again.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _checkStatus() async {
    final link = _linkResult;
    if (link == null || _checking) return;
    setState(() => _checking = true);
    try {
      final status = await getIt<PaymentRepository>().verify(link.payment.id);
      if (!mounted) return;
      setState(
        () => _linkStatus =
            const {'SUCCESS', 'FAILED'}.contains(status) ? status : 'PENDING',
      );
      if (status == 'SUCCESS') {
        teamSnack(context, 'Payment received!');
        if (teamCan(context, PayPerm.view)) {
          unawaited(
            context.push(AppRoutes.paymentDetail, extra: link.payment.id),
          );
        }
      } else if (status == 'FAILED') {
        teamSnack(
          context,
          'This payment link expired or was cancelled.',
          error: true,
        );
      } else {
        teamSnack(
          context,
          'Not paid yet — check again once the member completes the payment.',
        );
      }
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) {
        teamSnack(context, 'Could not check the status ($e)', error: true);
      }
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  Future<void> _resend(String medium) async {
    final link = _linkResult;
    if (link == null || _resending != null) return;
    setState(() => _resending = medium);
    try {
      await getIt<PaymentRepository>().resendLink(link.payment.id, medium);
      if (!mounted) return;
      teamSnack(
        context,
        'Payment link resent by ${medium == 'email' ? 'email' : 'SMS'}.',
      );
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) {
        teamSnack(context, 'Could not resend the link ($e)', error: true);
      }
    } finally {
      if (mounted) setState(() => _resending = null);
    }
  }

  Future<void> _copyLink() async {
    final link = _linkResult;
    if (link == null) return;
    await Clipboard.setData(ClipboardData(text: link.shortUrl));
    if (mounted) teamSnack(context, 'Link copied to clipboard.');
  }

  /// Web's "Send a different link": keeps member + invoice, clears the money.
  void _startOver() {
    setState(() {
      _linkResult = null;
      _linkStatus = null;
      _amount.clear();
      _discount.clear();
      _tax.clear();
      _notes.clear();
      _error = null;
    });
  }

  void _resetAll() {
    setState(() {
      _recorded = null;
      _linkResult = null;
      _linkStatus = null;
      _member = null;
      _results = [];
      _lastPayment = null;
      _recent = null;
      _invoices = null;
      _invoiceId = '';
      _due = null;
      _amount.clear();
      _discount.clear();
      _tax.clear();
      _reference.clear();
      _notes.clear();
      _searchController.clear();
      _method = PaymentMethod.upi;
      _date = _today();
      _dateTouched = false;
      _channel = _Channel.offline;
      _notifyEmail = false;
      _notifySms = false;
      _error = null;
    });
  }

  void _cancel() {
    if (Navigator.of(context).canPop()) {
      context.pop();
    } else {
      _resetAll();
    }
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    final canPop = Navigator.of(context).canPop();
    final hasMember = _member != null;
    final hasAmount = _amountValue > 0;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 90),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ListHero(
              title: 'Record a payment',
              subtitle:
                  'Log cash or UPI taken at the desk, or send a secure link.',
              topInset: top,
              side: 18 + teamSideInset(context),
              leading: canPop
                  ? ListHeroButton(
                      icon: Icons.arrow_back_rounded,
                      onTap: () => context.pop(),
                    )
                  : ListHeroButton(
                      icon: Icons.menu_rounded,
                      onTap: () => SlideDrawerController.of(context)?.open(),
                    ),
              chips: [
                ListHeroChip(
                  icon: hasMember
                      ? Icons.check_circle_rounded
                      : Icons.looks_one_rounded,
                  label: 'Member',
                ),
                ListHeroChip(
                  icon: hasMember && hasAmount
                      ? Icons.check_circle_rounded
                      : Icons.looks_two_rounded,
                  label: 'Details',
                ),
                ListHeroChip(
                  icon: _recorded != null || _linkResult != null
                      ? Icons.check_circle_rounded
                      : Icons.looks_3_rounded,
                  label: 'Review',
                ),
              ],
            ),
            TeamCenter(
              maxWidth: 1100,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: _recorded != null ? _confirmation(_recorded!) : _form(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _form() {
    final main = <Widget>[
      _memberSection(),
      if (_canInvoice) _invoiceSection(),
      _payingSection(),
    ];
    final side = <Widget>[_summary(), _recentCard(), _cardNote()];
    return LayoutBuilder(
      builder: (context, c) {
        Widget stack(List<Widget> items) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < items.length; i++) ...[
                  if (i > 0) const SizedBox(height: 14),
                  items[i],
                ],
              ],
            );
        if (c.maxWidth < 860) return stack([...main, ...side]);
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(flex: 3, child: stack(main)),
            const SizedBox(width: 14),
            Expanded(flex: 2, child: stack(side)),
          ],
        );
      },
    );
  }

  // ── 1 · member ────────────────────────────────────────────────────────────

  Widget _memberSection() {
    final m = _member;
    return TeamFormSection(
      icon: Icons.person_search_rounded,
      color: TeamColors.indigo,
      title: '1 · Member',
      subtitle: 'Search and pick the member this payment is for.',
      children: [
        if (m == null) ...[
          AppLabeledField(
            label: 'Member',
            controller: _searchController,
            icon: Icons.search_rounded,
            iconColor: TeamColors.indigo,
            hintText: 'Search by name or member ID…',
            onChanged: _onSearchChanged,
            maxLines: 1,
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
          if (_results.isNotEmpty)
            Container(
              decoration: BoxDecoration(
                color: AppColors.surface2,
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.line),
              ),
              child: Material(
                color: Colors.transparent,
                child: Column(
                  children: [
                    for (final r in _results)
                      ListTile(
                        onTap: () => _selectMember(r),
                        leading: PayAvatar(name: r.name, seed: r.id, size: 38),
                        title: Text(
                          r.name,
                          style:
                              AppText.body(size: 13.5, weight: FontWeight.w800),
                        ),
                        subtitle: Text(
                          [
                            r.memberId,
                            if (r.planName != null) r.planName!,
                          ].join(' · '),
                          style: AppText.body(
                            size: 11.5,
                            color: AppColors.inkFaint,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
        ] else
          _snapshot(m),
      ],
    );
  }

  Widget _snapshot(MemberSummary m) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            TeamColors.indigo.withValues(alpha: 0.16),
            TeamColors.violet.withValues(alpha: 0.06),
          ],
        ),
        border: Border.all(color: TeamColors.indigo.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              PayAvatar(name: m.name, seed: m.id, size: 48),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      m.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.display(size: 17),
                    ),
                    Text(
                      m.planName == null
                          ? '${m.memberId} · No active membership'
                          : '${m.memberId} · ${m.planName}'
                              '${m.planEndDate != null ? ' · active until ${payDate(m.planEndDate!)}' : ''}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 11.5,
                        color: AppColors.inkSoft,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              TextButton(onPressed: _clearMember, child: const Text('Change')),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _snapStat(
                  'OUTSTANDING',
                  payMoney(m.outstandingAmount),
                  m.outstandingAmount > 0 ? TeamColors.amber : null,
                ),
              ),
              Expanded(
                child: _snapStat(
                  'LAST PAYMENT',
                  _lastPayment == null
                      ? (_recent == null ? '…' : '—')
                      : payDate(_lastPayment!.paymentDate, year: false),
                  null,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _snapStat(String label, String value, Color? color) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppText.eyebrow()),
          const SizedBox(height: 2),
          Text(value, style: AppText.display(size: 16, color: color)),
        ],
      );

  // ── 2 · invoice ───────────────────────────────────────────────────────────

  Widget _invoiceSection() {
    final m = _member;
    final invoices = _invoices;
    return TeamFormSection(
      icon: Icons.description_rounded,
      color: TeamColors.teal,
      title: '2 · Invoice (optional)',
      subtitle: 'Settle one of the member\'s outstanding invoices.',
      children: [
        if (m == null)
          Text(
            'Select a member to see their outstanding invoices.',
            style: AppText.body(size: 12.5, color: AppColors.inkFaint),
          )
        else ...[
          for (final inv in invoices ?? const <PayableInvoice>[])
            TeamChoiceCard(
              title: '${inv.number} · ${payMoney(inv.total)}',
              description:
                  'Due ${inv.dueDate == null ? '—' : payDate(inv.dueDate!, year: false)}'
                  ' · ${inv.isPartiallyPaid ? 'Partially paid' : 'Unpaid'}',
              icon: Icons.receipt_long_rounded,
              color: TeamColors.teal,
              selected: _invoiceId == inv.id,
              onTap: () => _selectInvoice(inv.id),
            ),
          TeamChoiceCard(
            title: 'No invoice',
            description: invoices == null
                ? 'Checking invoices…'
                : invoices.isEmpty
                    ? 'No outstanding invoices for this member'
                    : 'Don\'t link this payment to an invoice',
            icon: Icons.link_off_rounded,
            color: TeamColors.slate,
            selected: _invoiceId.isEmpty,
            onTap: () => _selectInvoice(''),
          ),
          if (_due != null)
            Text.rich(
              TextSpan(
                style: AppText.body(size: 12.5, color: AppColors.inkSoft),
                children: [
                  const TextSpan(text: 'Invoice total '),
                  TextSpan(
                    text: payMoney(_due!.total),
                    style: AppText.body(size: 12.5, weight: FontWeight.w800),
                  ),
                  const TextSpan(text: ' · paid so far '),
                  TextSpan(
                    text: payMoney(_due!.paid),
                    style: AppText.body(size: 12.5, weight: FontWeight.w800),
                  ),
                  const TextSpan(text: ' · due '),
                  TextSpan(
                    text: payMoney(_due!.due),
                    style: AppText.body(size: 12.5, weight: FontWeight.w800),
                  ),
                ],
              ),
            ),
        ],
      ],
    );
  }

  // ── 3 · how is it being paid ──────────────────────────────────────────────

  Widget _payingSection() {
    final m = _member;
    final link = _linkResult;
    final showLink = _channel == _Channel.link && link != null;
    final due = _due?.due ?? 0;
    return TeamFormSection(
      icon: Icons.account_balance_wallet_rounded,
      color: TeamColors.violet,
      title: '3 · How is it being paid?',
      children: [
        if (_error != null) FormAlert(message: _error!),
        TeamChoiceCard(
          title: 'Collected now',
          description: 'Cash, UPI, cheque or transfer at the desk',
          icon: Icons.point_of_sale_rounded,
          color: TeamColors.violet,
          selected: _channel == _Channel.offline,
          onTap: () => setState(() => _channel = _Channel.offline),
        ),
        TeamChoiceCard(
          title: 'Send payment link',
          description: 'Member pays online via the gateway',
          icon: Icons.link_rounded,
          color: TeamColors.violet,
          selected: _channel == _Channel.link,
          onTap: () => setState(() => _channel = _Channel.link),
        ),
        if (showLink)
          _linkPanel(link, m)
        else ...[
          if (_channel == _Channel.offline) ...[
            Text('METHOD', style: AppText.eyebrow()),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final pm in PaymentMethod.values)
                  TeamFilterChip(
                    label: pm.label,
                    selected: _method == pm,
                    onTap: () => setState(() => _method = pm),
                  ),
              ],
            ),
          ],
          AppLabeledField(
            label: 'Amount',
            controller: _amount,
            icon: Icons.currency_rupee_rounded,
            iconColor: TeamColors.green,
            hintText: AppCurrency.symbol,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: _money,
            onChanged: (_) => setState(() {}),
          ),
          if (_due != null && due > 0)
            Wrap(
              spacing: 8,
              children: [
                ActionChip(
                  label: const Text('Full invoice'),
                  onPressed: () =>
                      setState(() => _amount.text = due.toStringAsFixed(2)),
                ),
                ActionChip(
                  label: const Text('Half'),
                  onPressed: () => setState(
                    () => _amount.text = (due / 2).toStringAsFixed(2),
                  ),
                ),
              ],
            ),
          AppLabeledField(
            label: 'Discount',
            controller: _discount,
            icon: Icons.sell_rounded,
            iconColor: TeamColors.amber,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: _money,
            onChanged: (_) => setState(() {}),
          ),
          AppLabeledField(
            label: 'Tax',
            controller: _tax,
            icon: Icons.percent_rounded,
            iconColor: TeamColors.sky,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: _money,
            onChanged: (_) => setState(() {}),
          ),
          if (_channel == _Channel.offline) ...[
            TeamDateField(
              label: 'Payment date',
              icon: Icons.event_rounded,
              iconColor: TeamColors.indigo,
              value: _date,
              clearable: false,
              firstDate: DateTime(2020),
              lastDate: _today(),
              onChanged: (d) => setState(() {
                if (d != null) {
                  _date = d;
                  _dateTouched = true;
                }
              }),
            ),
            AppLabeledField(
              label: 'Transaction reference',
              controller: _reference,
              icon: Icons.tag_rounded,
              iconColor: TeamColors.fuchsia,
              hintText: 'UPI ref / cheque no. (optional)',
            ),
          ],
          AppLabeledField(
            label: 'Notes',
            controller: _notes,
            icon: Icons.notes_rounded,
            iconColor: TeamColors.slate,
            hintText: 'Internal note (optional)',
            minLines: 2,
            maxLines: 4,
          ),
          if (_channel == _Channel.link) ...[
            Text(
              'IF SENDING A PAYMENT LINK',
              style: AppText.eyebrow(),
            ),
            TeamToggleRow(
              title: 'Email the link',
              subtitle: m != null && !m.hasEmail ? '(no email on file)' : null,
              icon: Icons.mail_outline_rounded,
              color: TeamColors.indigo,
              value: _notifyEmail && (m?.hasEmail ?? false),
              onChanged: (m?.hasEmail ?? false)
                  ? (v) => setState(() => _notifyEmail = v)
                  : null,
            ),
            TeamToggleRow(
              title: 'SMS the link',
              subtitle: m != null && !m.hasPhone ? '(no phone on file)' : null,
              icon: Icons.sms_outlined,
              color: TeamColors.teal,
              value: _notifySms && (m?.hasPhone ?? false),
              onChanged: (m?.hasPhone ?? false)
                  ? (v) => setState(() => _notifySms = v)
                  : null,
            ),
          ],
        ],
      ],
    );
  }

  Widget _linkPanel(PaymentLinkResult link, MemberSummary? m) {
    final status = _linkStatus ?? 'PENDING';
    final color = switch (status) {
      'SUCCESS' => TeamColors.green,
      'FAILED' => TeamColors.rose,
      _ => TeamColors.amber,
    };
    final sentBy = [
      if (link.notifiedEmail) 'email',
      if (link.notifiedSms) 'SMS',
    ].join(' and ');
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: AppColors.surface2,
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Payment link for ${m?.name ?? ''}'
                  '${sentBy.isEmpty ? ' — not auto-sent; share the link yourself.' : ' — sent by $sentBy.'}',
                  style: AppText.body(size: 12.5, color: AppColors.inkSoft),
                ),
              ),
              const SizedBox(width: 8),
              TeamTag(
                label: switch (status) {
                  'SUCCESS' => 'Paid',
                  'FAILED' => 'Failed / expired',
                  _ => 'Awaiting payment',
                },
                color: color,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.fromLTRB(12, 4, 4, 4),
            decoration: BoxDecoration(
              color: AppColors.surface3,
              borderRadius: BorderRadius.circular(AppRadii.field),
            ),
            child: Row(
              children: [
                Expanded(
                  child: SelectableText(
                    link.shortUrl,
                    maxLines: 1,
                    style: AppText.body(size: 12.5, weight: FontWeight.w700),
                  ),
                ),
                IconButton(
                  tooltip: 'Copy link',
                  icon: const Icon(Icons.copy_rounded, size: 18),
                  color: AppColors.inkSoft,
                  onPressed: _copyLink,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          TeamOutlineButton(
            label: _checking ? 'Checking…' : 'Check payment status',
            icon: Icons.sync_rounded,
            onTap: _checking ? null : _checkStatus,
          ),
          const SizedBox(height: 8),
          TeamOutlineButton(
            label: _resending == 'email' ? 'Resending…' : 'Resend by email',
            icon: Icons.mail_outline_rounded,
            onTap: (m?.hasEmail ?? false) && _resending == null
                ? () => _resend('email')
                : null,
          ),
          const SizedBox(height: 8),
          TeamOutlineButton(
            label: _resending == 'sms' ? 'Resending…' : 'Resend by SMS',
            icon: Icons.sms_outlined,
            onTap: (m?.hasPhone ?? false) && _resending == null
                ? () => _resend('sms')
                : null,
          ),
          const SizedBox(height: 4),
          Center(
            child: TextButton(
              onPressed: _startOver,
              child: const Text('Send a different link'),
            ),
          ),
        ],
      ),
    );
  }

  // ── summary + side cards ──────────────────────────────────────────────────

  Widget _summary() {
    final online = _channel == _Channel.link;
    final due = _due;
    final remainingAfter =
        due == null ? null : (due.due - _finalAmount).clamp(0, double.infinity);
    final note = due != null && remainingAfter != null
        ? (online
            ? 'Invoice ${due.number} is updated once the member pays through the link.'
            : 'Invoice ${due.number} will be marked '
                '${remainingAfter < 0.005 ? 'Paid' : 'Partially paid'}'
                '${remainingAfter >= 0.005 ? ' (${payMoney(remainingAfter.toDouble())} remaining)' : ''}.')
        : (online
            ? 'The payment stays pending until the member completes it on the gateway page.'
            : 'Not linked to an invoice.');
    final linkMade = online && _linkResult != null;
    return TeamSectionCard(
      icon: Icons.summarize_rounded,
      color: TeamColors.indigo,
      title: 'Summary',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _sumRow('Amount', payMoney(_amountValue)),
          _sumRow(
            'Discount',
            '− ${payMoney(_discountValue)}',
            color: TeamColors.green,
          ),
          _sumRow('Tax', payMoney(_taxValue)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              gradient: TeamColors.cta,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    online ? 'Total to collect' : 'Total received',
                    style: AppText.body(
                      size: 13,
                      weight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ),
                PayMoneyCount(
                  value: _finalAmount,
                  style: AppText.display(size: 22, color: Colors.white),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Text(
            note,
            style: AppText.body(
              size: 12,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 14),
          if (!linkMade)
            TeamGradientButton(
              label: online
                  ? 'Generate payment link'
                  : 'Record ${payMoney(_finalAmount)} payment',
              icon: online ? Icons.link_rounded : Icons.check_rounded,
              loading: _submitting,
              onTap: _submitting ? null : _submit,
            ),
          const SizedBox(height: 8),
          TeamOutlineButton(
            label: Navigator.of(context).canPop() ? 'Cancel' : 'Clear form',
            onTap: _cancel,
          ),
        ],
      ),
    );
  }

  Widget _sumRow(String label, String value, {Color? color}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: AppText.body(
                  size: 13,
                  color: AppColors.inkSoft,
                  weight: FontWeight.w700,
                ),
              ),
            ),
            Text(value, style: AppText.tabular(size: 13, color: color)),
          ],
        ),
      );

  Widget _recentCard() {
    final recent = _recent;
    return TeamSectionCard(
      icon: Icons.history_rounded,
      color: TeamColors.teal,
      title: 'Recent for this member',
      child: _member == null
          ? const PayEmptyNote('Pick a member to see their latest payments.')
          : recent == null
              ? const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: LinearProgressIndicator(color: AppColors.staffB),
                )
              : recent.isEmpty
                  ? const PayEmptyNote('No payments yet.')
                  : Column(
                      children: [
                        for (var i = 0; i < recent.length; i++)
                          Container(
                            padding: const EdgeInsets.symmetric(vertical: 9),
                            decoration: BoxDecoration(
                              border: i == 0
                                  ? null
                                  : Border(
                                      top: BorderSide(color: AppColors.line),
                                    ),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    recent[i].paymentNumber,
                                    style: AppText.tabular(size: 12.5),
                                  ),
                                ),
                                Text(
                                  payMoney(recent[i].finalAmount),
                                  style: AppText.tabular(size: 12.5),
                                ),
                                const SizedBox(width: 8),
                                payStatusTag(recent[i].status),
                              ],
                            ),
                          ),
                      ],
                    ),
    );
  }

  Widget _cardNote() => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: TeamColors.indigo.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: TeamColors.indigo.withValues(alpha: 0.25)),
        ),
        child: Text(
          'Card details are never entered here. Online payments go through '
          'the gateway link.',
          style: AppText.body(
            size: 12.5,
            weight: FontWeight.w700,
            color: TeamColors.indigo,
          ),
        ),
      );

  // ── confirmation ──────────────────────────────────────────────────────────

  Widget _confirmation(MemberPayment payment) {
    final canPop = Navigator.of(context).canPop();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                TeamColors.green.withValues(alpha: 0.2),
                TeamColors.teal.withValues(alpha: 0.06),
              ],
            ),
            border: Border.all(color: TeamColors.green.withValues(alpha: 0.35)),
          ),
          child: Column(
            children: [
              PopIn(
                index: 0,
                child: Container(
                  width: 68,
                  height: 68,
                  decoration: const BoxDecoration(
                    color: TeamColors.green,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check_rounded,
                    color: Colors.white,
                    size: 34,
                  ),
                ),
              ),
              const SizedBox(height: 14),
              PayMoneyCount(
                value: payment.finalAmount,
                style: AppText.display(size: 30),
              ),
              const SizedBox(height: 4),
              Text(
                'Payment recorded · ${_member?.name ?? payment.memberName}',
                textAlign: TextAlign.center,
                style: AppText.body(
                  size: 13,
                  color: AppColors.inkSoft,
                  weight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        TeamSectionCard(
          icon: Icons.receipt_long_rounded,
          color: TeamColors.indigo,
          title: 'Receipt',
          child: Column(
            children: [
              PayInfoRow(
                first: true,
                label: 'Payment #',
                value: payment.paymentNumber,
              ),
              PayInfoRow(label: 'Status', child: payStatusTag(payment.status)),
              PayInfoRow(
                label: 'Method',
                value: paymentMethodLabel(payment.method),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (teamCan(context, PayPerm.view)) ...[
          TeamGradientButton(
            label: 'View payment',
            icon: Icons.open_in_new_rounded,
            onTap: () => context.push(
              AppRoutes.paymentDetail,
              extra: payment.id,
            ),
          ),
          const SizedBox(height: 10),
        ],
        TeamOutlineButton(
          label: canPop ? 'Done' : 'Record another',
          onTap: () {
            if (canPop) {
              context.pop();
            } else {
              _resetAll();
            }
          },
        ),
      ],
    );
  }
}
