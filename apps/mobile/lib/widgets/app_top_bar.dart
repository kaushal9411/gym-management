import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Reproduces the design's `.app-topbar` — a small uppercase caption over a
/// Bebas Neue title, with a trailing widget (avatar / action button) — used
/// on every tab-root screen instead of a native AppBar, which the design
/// never uses for these.
class AppTopBar extends StatelessWidget {
  final String caption;
  final String title;
  final Widget? trailing;

  const AppTopBar({
    super.key,
    required this.caption,
    required this.title,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                caption.toUpperCase(),
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: .8,
                  color: colors.inkFaint,
                ),
              ),
              Text(
                title,
                style: const TextStyle(fontFamily: 'Bebas Neue', fontSize: 24),
              ),
            ],
          ),
        ),
        if (trailing != null) trailing!,
      ],
    );
  }
}
