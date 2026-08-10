import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/membership_plan.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'widgets/donut_chart.dart';

const _sliceColors = [
  AppColors.staffB,
  AppColors.staffA,
  AppColors.success,
  AppColors.warning,
  AppColors.memberB,
];

/// Design frame "9b. Membership report" — plan distribution reuses
/// `MembershipPlanDto.memberCount` (already fetched for the catalog screen)
/// rather than a dedicated aggregation endpoint.
class MembershipReportScreen extends StatefulWidget {
  const MembershipReportScreen({super.key});

  @override
  State<MembershipReportScreen> createState() => _MembershipReportScreenState();
}

class _MembershipReportScreenState extends State<MembershipReportScreen> {
  List<MembershipPlan>? _plans;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final result = await getIt<MembershipPlanRepository>().list(limit: 100);
      if (!mounted) return;
      setState(() => _plans = result.items);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Plan distribution', style: AppText.eyebrow()),
            Text('Membership Report', style: AppText.display(size: 18)),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : _plans == null
                ? const AppLoadingView()
                : _buildContent(_plans!),
      ),
    );
  }

  Widget _buildContent(List<MembershipPlan> plans) {
    final withMembers = plans.where((p) => p.memberCount > 0).toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        AppCard(
          child: withMembers.isEmpty
              ? Text(
                  'No members assigned to a plan yet.',
                  style: AppText.body(color: AppColors.inkFaint),
                )
              : DonutChart(
                  slices: [
                    for (var i = 0; i < withMembers.length; i++)
                      DonutSlice(
                        label: withMembers[i].name,
                        value: withMembers[i].memberCount,
                        color: _sliceColors[i % _sliceColors.length],
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}
