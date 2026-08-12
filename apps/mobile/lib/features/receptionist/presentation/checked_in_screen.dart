import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/app_button.dart';

/// Design frame "4a. Checked in".
class CheckedInScreen extends StatelessWidget {
  const CheckedInScreen({super.key, required this.memberName});

  final String memberName;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final hour = now.hour % 12 == 0 ? 12 : now.hour % 12;
    final minute = now.minute.toString().padLeft(2, '0');
    final period = now.hour >= 12 ? 'PM' : 'AM';
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0x2E3DDC84), Color(0x0F14E0B4)],
                  ),
                  borderRadius: BorderRadius.circular(AppRadii.glass),
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
                    Text('Checked in', style: AppText.display(size: 20)),
                    const SizedBox(height: 2),
                    Text(
                      memberName,
                      style: AppText.body(color: AppColors.inkFaint),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surface2,
                  borderRadius: BorderRadius.circular(AppRadii.card),
                  border: Border.all(color: AppColors.line),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Time',
                      style: AppText.body(
                        size: 13,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      '$hour:$minute $period',
                      style: AppText.body(size: 13, weight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              AppButton(label: 'Scan next', onPressed: () => context.pop()),
            ],
          ),
        ),
      ),
    );
  }
}
