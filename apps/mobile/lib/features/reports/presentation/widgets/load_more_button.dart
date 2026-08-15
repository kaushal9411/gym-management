import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';

/// Page-at-a-time "Load more" footer for report list screens — appends the
/// next page on tap rather than infinite-scrolling, so a slow connection
/// never silently keeps firing requests as the user scrolls.
class LoadMoreButton extends StatelessWidget {
  const LoadMoreButton({
    super.key,
    required this.loading,
    required this.onPressed,
    required this.shownCount,
    required this.totalCount,
  });

  final bool loading;
  final VoidCallback onPressed;
  final int shownCount;
  final int totalCount;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Column(
        children: [
          Text(
            'Showing $shownCount of $totalCount',
            style: AppText.body(
              size: 11,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 10),
          AppButton(
            label: 'Load more',
            variant: AppButtonVariant.ghost,
            size: AppButtonSize.small,
            fullWidth: false,
            loading: loading,
            onPressed: onPressed,
          ),
        ],
      ),
    );
  }
}
