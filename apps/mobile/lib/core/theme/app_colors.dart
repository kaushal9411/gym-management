import 'package:flutter/material.dart';

/// Dark values are an exact 1:1 port of the approved design's `:root` CSS custom properties; light values were added with the theme setting
/// (`fitcloud-kinetic-design-v2.html`). Do not "improve" or re-tune these —
/// they are the single source of truth for the Kinetic visual system.
class AppColors {
  AppColors._();

  /// Set by `ThemeCubit` before the tree rebuilds. Neutral surfaces, ink
  /// and the soft/pill tints below switch on it; the brand gradients and
  /// status hues stay `const` so they remain usable in const contexts.
  static bool isLight = false;

  static Color _pick(Color dark, Color light) => isLight ? light : dark;

  static Color get bg => _pick(const Color(0xFF120E1A), const Color(0xFFF6F5FB));
  static Color get surface =>
      _pick(const Color(0xFF1B1526), const Color(0xFFFFFFFF));
  static Color get surface2 =>
      _pick(const Color(0xFF241C33), const Color(0xFFFFFFFF));
  static Color get surface3 =>
      _pick(const Color(0xFF2E2440), const Color(0xFFEEEBF8));
  static Color get line =>
      _pick(const Color(0xFF362A45), const Color(0xFFE2DFEE));

  static Color get ink =>
      _pick(const Color(0xFFF5F1FA), const Color(0xFF16132B));
  static Color get inkSoft =>
      _pick(const Color(0xFFC4B8D6), const Color(0xFF4A4666));
  static Color get inkFaint =>
      _pick(const Color(0xFF8B7DA3), const Color(0xFF6B6788));

  // Staff — coral → violet
  static const staffA = Color(0xFFFF6B5B);
  static const staffB = Color(0xFF8B5CF6);
  static Color get staffSoft =>
      _pick(const Color(0xFF2A2140), const Color(0xFFEEEAFE));
  static const staffGlow = Color(0x598B5CF6); // rgba(139,92,246,.35)
  static const staffGrad = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [staffA, staffB],
  );
  static Color get staffPillFg =>
      _pick(const Color(0xFFC9B8FF), const Color(0xFF5B3FD6));

  // Member — lime → teal
  static const memberA = Color(0xFFC6F135);
  static const memberB = Color(0xFF14E0B4);
  static Color get memberSoft =>
      _pick(const Color(0xFF16332C), const Color(0xFFDDF7EE));
  static const memberGlow = Color(0x4D14E0B4); // rgba(20,224,180,.3)
  static const memberGrad = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [memberA, memberB],
  );
  static const memberOnGrad = Color(0xFF0B231D);
  static Color get memberPillFg =>
      _pick(const Color(0xFF8CF0D6), const Color(0xFF0B7A63));

  static const success = Color(0xFF3DDC84);
  static Color get successSoft =>
      _pick(const Color(0xFF123322), const Color(0xFFDFF6E8));
  static const warning = Color(0xFFFFB648);
  static Color get warningSoft =>
      _pick(const Color(0xFF3A2A10), const Color(0xFFFFF1D9));
  static const danger = Color(0xFFFF5C7A);
  static Color get dangerSoft =>
      _pick(const Color(0xFF3A121D), const Color(0xFFFFE3E8));

  static Color get glassFill =>
      _pick(const Color(0x0EFFFFFF), const Color(0xB3FFFFFF));
  static Color get glassBorder =>
      _pick(const Color(0x1CFFFFFF), const Color(0x2616132B));
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
