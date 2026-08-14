import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/scheduled_report.dart';
import '../../../repositories/scheduled_report_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';

class ScheduledReportFormScreen extends StatefulWidget {
  const ScheduledReportFormScreen({super.key});

  @override
  State<ScheduledReportFormScreen> createState() =>
      _ScheduledReportFormScreenState();
}

class _ScheduledReportFormScreenState extends State<ScheduledReportFormScreen> {
  final _nameController = TextEditingController();
  late final _emailController =
      TextEditingController(text: _defaultEmail(context));
  ScheduledReportType _reportType = ScheduledReportType.revenue;
  ReportFrequency _frequency = ReportFrequency.weekly;
  bool _loading = false;
  String? _error;

  String _defaultEmail(BuildContext context) {
    final session = context.read<SessionCubit>().state;
    return session is SessionAuthenticatedStaff ? session.user.email : '';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    final emails = _emailController.text
        .split(',')
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .toList();
    if (name.isEmpty) {
      setState(() => _error = 'Give this report a name');
      return;
    }
    if (emails.isEmpty) {
      setState(() => _error = 'Add at least one recipient email');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await getIt<ScheduledReportRepository>().create(
        name: name,
        reportType: _reportType,
        frequency: _frequency,
        recipientEmails: emails,
      );
      if (!mounted) return;
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: const Text('New Scheduled Report'),
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_error != null) ...[
                const SizedBox(height: 8),
                FormAlert(message: _error!),
              ],
              const SizedBox(height: 16),
              AppLabeledField(
                label: 'Report name',
                hintText: 'e.g. Weekly revenue summary',
                controller: _nameController,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              Text('Report type', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              CategoryChipSelector<ScheduledReportType>(
                options: ScheduledReportType.values,
                labelOf: (t) => t.label,
                value: _reportType,
                onChanged: (t) => setState(() => _reportType = t),
              ),
              const SizedBox(height: 14),
              Text('Frequency', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              CategoryChipSelector<ReportFrequency>(
                options: ReportFrequency.values,
                labelOf: (f) => f.label,
                value: _frequency,
                onChanged: (f) => setState(() => _frequency = f),
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Recipient email(s)',
                hintText: 'comma-separated, e.g. a@gym.com, b@gym.com',
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.done,
              ),
              const SizedBox(height: 24),
              AppButton(
                label: 'Create schedule',
                loading: _loading,
                onPressed: _submit,
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
