import 'package:flutter/material.dart';

import '../../../../shared/widgets/app_state_views.dart';

/// Placeholder for bottom-nav tabs whose full module lands in a later
/// sub-chunk (Members, Finance, Reports) — an honest "not built yet" state
/// rather than a fabricated screen with fake data.
class ComingSoonTab extends StatelessWidget {
  const ComingSoonTab({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return AppEmptyState(
      icon: Icons.construction_outlined,
      title: '$title is coming soon',
      message: 'This section is being built in a follow-up update.',
    );
  }
}
