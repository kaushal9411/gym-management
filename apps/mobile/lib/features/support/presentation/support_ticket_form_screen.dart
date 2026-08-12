import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/support_ticket.dart';
import '../../../repositories/support_ticket_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';

class SupportTicketFormScreen extends StatefulWidget {
  const SupportTicketFormScreen({super.key});

  @override
  State<SupportTicketFormScreen> createState() =>
      _SupportTicketFormScreenState();
}

class _SupportTicketFormScreenState extends State<SupportTicketFormScreen> {
  final _subjectController = TextEditingController();
  final _descriptionController = TextEditingController();
  TicketPriority _priority = TicketPriority.medium;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _subjectController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final subject = _subjectController.text.trim();
    final description = _descriptionController.text.trim();
    if (subject.length < 3) {
      setState(() => _error = 'Subject needs at least 3 characters');
      return;
    }
    if (description.length < 10) {
      setState(() => _error = 'Describe the issue in at least 10 characters');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await getIt<SupportTicketRepository>().create(
        subject: subject,
        description: description,
        priority: _priority,
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
        title: const Text('New Support Ticket'),
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
                label: 'Subject',
                controller: _subjectController,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Describe the issue',
                controller: _descriptionController,
                textInputAction: TextInputAction.newline,
              ),
              const SizedBox(height: 14),
              Text('Priority', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              CategoryChipSelector<TicketPriority>(
                options: TicketPriority.values,
                labelOf: (p) => p.label,
                value: _priority,
                onChanged: (p) => setState(() => _priority = p),
              ),
              const SizedBox(height: 24),
              AppButton(
                label: 'Submit ticket',
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
