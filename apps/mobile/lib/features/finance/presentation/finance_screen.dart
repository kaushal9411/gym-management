import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import 'finance_tab.dart';

/// [FinanceTab] wrapped as a pushable route (back-arrow AppBar) — Owner
/// reaches it as a bottom-nav tab inside [OwnerShell]; Manager reaches the
/// same real screen from its Menu instead, since Manager's bottom nav has
/// no Finance slot (design frame "4c. Menu" → "Money" section).
class FinanceScreen extends StatelessWidget {
  const FinanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(backgroundColor: AppColors.bg, elevation: 0),
      body: const SafeArea(top: false, child: FinanceTab()),
    );
  }
}
