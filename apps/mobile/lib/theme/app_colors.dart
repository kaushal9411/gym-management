import 'package:flutter/material.dart';

/// Ported 1:1 from the approved visual design (fitcloud-mobile-design.html):
/// warm-stone neutrals, cobalt for staff surfaces, amber for member surfaces.
class AppColors {
  AppColors._();

  static const accentStaff = Color(0xFF2E56D6);
  static const accentStaffSoft = Color(0xFFE7EDFC);
  static const accentStaffDeep = Color(0xFF16307E);
  static const accentMember = Color(0xFFD97A1F);
  static const accentMemberSoft = Color(0xFFFBEBD8);
  static const accentMemberDeep = Color(0xFF8C4C10);

  static const success = Color(0xFF3F9142);
  static const successSoft = Color(0xFFE6F2E6);
  static const warning = Color(0xFFC97F1D);
  static const warningSoft = Color(0xFFFBEEDA);
  static const danger = Color(0xFFC6432E);
  static const dangerSoft = Color(0xFFFBE7E3);

  // Light (staff) surface
  static const pageBgLight = Color(0xFFF5F4F1);
  static const surfaceLight = Color(0xFFFFFFFF);
  static const surface2Light = Color(0xFFFBFAF8);
  static const inkLight = Color(0xFF221E19);
  static const inkSoftLight = Color(0xFF6B6459);
  static const inkFaintLight = Color(0xFF94897A);
  static const borderLight = Color(0xFFDDD7CB);

  // Dark (member) surface
  static const pageBgDark = Color(0xFF16130F);
  static const surfaceDark = Color(0xFF221E19);
  static const surface2Dark = Color(0xFF1C1814);
  static const inkDark = Color(0xFFF2EFE9);
  static const inkSoftDark = Color(0xFFB4AC9E);
  static const inkFaintDark = Color(0xFF7D7669);
  static const borderDark = Color(0xFF332C24);
}
