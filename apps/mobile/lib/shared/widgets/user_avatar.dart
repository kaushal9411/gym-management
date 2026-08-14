import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';

/// Renders a user's photo when `avatarUrl` is set (a data: URL from a
/// pending pick, or an uploaded http(s) URL), falling back to the
/// gradient-initials circle used everywhere else in the app. Shared by
/// every header avatar badge (Owner/Manager/Trainer/Receptionist menu +
/// dashboard screens) and the "My Profile" hub's larger picker, so a
/// photo change shows up app-wide the moment the session refreshes.
class UserAvatar extends StatelessWidget {
  const UserAvatar({
    super.key,
    required this.avatarUrl,
    required this.name,
    this.size = 38,
  });

  final String? avatarUrl;
  final String name;
  final double size;

  String get _initials {
    final words =
        name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    if (words.isEmpty) return '?';
    if (words.length == 1) {
      return words.first
          .substring(0, words.first.length.clamp(0, 2))
          .toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final url = avatarUrl;
    if (url == null || url.isEmpty) return _fallback();

    if (url.startsWith('data:')) {
      final base64Part = url.split(',').last;
      try {
        return ClipOval(
          child: Image.memory(
            base64Decode(base64Part),
            width: size,
            height: size,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => _fallback(),
          ),
        );
      } catch (_) {
        return _fallback();
      }
    }

    return ClipOval(
      child: Image.network(
        url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _fallback(),
      ),
    );
  }

  Widget _fallback() => Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(
          gradient: AppColors.staffGrad,
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: Text(
          _initials,
          style: AppText.body(
            size: size * 0.32,
            weight: FontWeight.w800,
            color: Colors.white,
          ),
        ),
      );
}
