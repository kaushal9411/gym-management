import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'slide_drawer_scaffold.dart';

/// Hamburger trigger for the role's navigation drawer — every remaining
/// tab's header gets one (replacing the old bottom-nav "Menu" tab), styled
/// to match [NotificationBellIcon]'s circular chip. Relies on the nearest
/// ancestor [SlideDrawerScaffold] (the role shell's).
class MenuButton extends StatelessWidget {
  const MenuButton({super.key, this.size = 38});

  final double size;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => SlideDrawerController.of(context)?.open(),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: AppColors.surface2,
          shape: BoxShape.circle,
          border: Border.fromBorderSide(BorderSide(color: AppColors.line)),
        ),
        alignment: Alignment.center,
        child: Icon(
          Icons.menu_rounded,
          color: AppColors.ink,
          size: size * 0.5,
        ),
      ),
    );
  }
}
