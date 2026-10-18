import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/diet_plan.dart';
import '../../diet/presentation/diet_ui.dart';
import '../../diet/presentation/widgets/food_picker.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Design frame "8a. + Add to meal": search the active foods, tick one or
/// more, **Save meal** pops with the ticked `List<Food>` (the route's result
/// type is unchanged). The picker itself is shared with the Owner / Manager
/// meal builder's bottom sheet.
class AddToMealScreen extends StatelessWidget {
  const AddToMealScreen({required this.mealType, super.key});

  final MealType mealType;

  @override
  Widget build(BuildContext context) {
    final color = mealColor(mealType);
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(mealIcon(mealType), size: 17, color: color),
            ),
            const SizedBox(width: 10),
            Flexible(
              child: Text(
                'Add to ${mealType.label}',
                overflow: TextOverflow.ellipsis,
                style: AppText.display(size: 18),
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            16 + teamSideInset(context, maxWidth: 720),
            8,
            16 + teamSideInset(context, maxWidth: 720),
            16,
          ),
          child: FoodPicker(
            actionLabel: 'Save meal',
            onDone: (foods) => context.pop(foods),
          ),
        ),
      ),
    );
  }
}
