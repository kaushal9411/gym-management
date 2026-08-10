import 'package:flutter/material.dart';

/// Exact 1:1 port of the approved design's `:root` CSS custom properties
/// (`fitcloud-kinetic-design-v2.html`). Do not "improve" or re-tune these —
/// they are the single source of truth for the Kinetic visual system.
class AppColors {
  AppColors._();

  static const bg = Color(0xFF120E1A);
  static const surface = Color(0xFF1B1526);
  static const surface2 = Color(0xFF241C33);
  static const surface3 = Color(0xFF2E2440);
  static const line = Color(0xFF362A45);

  static const ink = Color(0xFFF5F1FA);
  static const inkSoft = Color(0xFFC4B8D6);
  static const inkFaint = Color(0xFF8B7DA3);

  // Staff — coral → violet
  static const staffA = Color(0xFFFF6B5B);
  static const staffB = Color(0xFF8B5CF6);
  static const staffSoft = Color(0xFF2A2140);
  static const staffGlow = Color(0x598B5CF6); // rgba(139,92,246,.35)
  static const staffGrad = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [staffA, staffB],
  );
  static const staffPillFg = Color(0xFFC9B8FF);

  // Member — lime → teal
  static const memberA = Color(0xFFC6F135);
  static const memberB = Color(0xFF14E0B4);
  static const memberSoft = Color(0xFF16332C);
  static const memberGlow = Color(0x4D14E0B4); // rgba(20,224,180,.3)
  static const memberGrad = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [memberA, memberB],
  );
  static const memberOnGrad = Color(0xFF0B231D);
  static const memberPillFg = Color(0xFF8CF0D6);

  static const success = Color(0xFF3DDC84);
  static const successSoft = Color(0xFF123322);
  static const warning = Color(0xFFFFB648);
  static const warningSoft = Color(0xFF3A2A10);
  static const danger = Color(0xFFFF5C7A);
  static const dangerSoft = Color(0xFF3A121D);

  static const glassFill = Color(0x0EFFFFFF); // rgba(255,255,255,.055)
  static const glassBorder = Color(0x1CFFFFFF); // rgba(255,255,255,.11)
}

/// Which accent a screen/component should render with — resolved once at
/// the Find Gym toggle and threaded down through Login/OTP/etc.
enum AppRole { staff, member }

extension AppRoleAccent on AppRole {
  Color get a => this == AppRole.staff ? AppColors.staffA : AppColors.memberA;
  Color get b => this == AppRole.staff ? AppColors.staffB : AppColors.memberB;
  Color get soft =>
      this == AppRole.staff ? AppColors.staffSoft : AppColors.memberSoft;
  Color get glow =>
      this == AppRole.staff ? AppColors.staffGlow : AppColors.memberGlow;
  Color get pillFg =>
      this == AppRole.staff ? AppColors.staffPillFg : AppColors.memberPillFg;
  Gradient get gradient =>
      this == AppRole.staff ? AppColors.staffGrad : AppColors.memberGrad;
  Color get onGradient =>
      this == AppRole.staff ? Colors.white : AppColors.memberOnGrad;
}
