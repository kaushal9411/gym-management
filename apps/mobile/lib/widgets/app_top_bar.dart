import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Reproduces the design's upgraded `.app-topbar` — a gradient surface
/// (cobalt on staff/light screens, amber on member/dark screens) with a
/// small uppercase caption over a Bebas Neue title in white, elevated with
/// a shadow, instead of the old flat/transparent bar. Used on every
/// tab-root screen instead of a native AppBar.
class AppTopBar extends StatelessWidget {
  final String caption;
  final String title;
  final Widget? trailing;

  /// When true, renders a white back-chevron ahead of the caption/title and
  /// pops the current route — used by pushed (non-tab-root) screens that
  /// previously relied on a native `AppBar`'s automatic back button.
  final bool showBackButton;

  const AppTopBar({
    super.key,
    required this.caption,
    required this.title,
    this.trailing,
    this.showBackButton = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [colors.accent, colors.accentDeep],
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: AppShadows.md,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (showBackButton)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: InkWell(
                borderRadius: BorderRadius.circular(18),
                onTap: () => Navigator.of(context).maybePop(),
                child: const Padding(
                  padding: EdgeInsets.all(2),
                  child: Icon(Icons.arrow_back_rounded, color: Colors.white),
                ),
              ),
            ),
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
                    color: Colors.white.withValues(alpha: .8),
                  ),
                ),
                Text(
                  title,
                  style: const TextStyle(
                    fontFamily: 'Bebas Neue',
                    fontSize: 24,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}
