import 'package:flutter/material.dart';

import '../../core/theme/app_text_styles.dart';
import '../../features/manager/presentation/widgets/member_detail_anim.dart';

/// Content height (below the status bar) shared by every list-screen hero, so
/// all of them are exactly the same size whatever they show.
const kListHeroHeight = 210.0;

/// Minimum content height for heroes that sit under a transparent AppBar
/// (status bar + [kToolbarHeight] already above them), so they end at the
/// same line as a [ListHero]. Paddings: 2 top + 18 bottom.
const kListHeroBelowAppBar = kListHeroHeight - 56 - 2 - 18;

/// Round translucent button used on the hero (menu / back / add / filter).
class ListHeroButton extends StatelessWidget {
  const ListHeroButton({super.key, required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white.withValues(alpha: 0.18),
          border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
        ),
        child: Icon(icon, color: Colors.white, size: 20),
      ),
    );
  }
}

/// Translucent count chip used on the hero.
class ListHeroChip extends StatelessWidget {
  const ListHeroChip({super.key, required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: Colors.white.withValues(alpha: 0.32)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: Colors.white),
          const SizedBox(width: 6),
          Text(
            label,
            style: AppText.body(
              size: 12,
              weight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

/// The one gradient header every list screen uses: full-bleed gradient of a
/// fixed height ([kListHeroHeight] + [topInset]); button row on top, big title
/// + subtitle, then chips pinned to the bottom. Content is inset by [side] so
/// it lines up with the page column on tablets.
class ListHero extends StatelessWidget {
  const ListHero({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.trailing = const [],
    this.chips = const [],
    this.topInset = 0,
    this.side = 18,
  });

  final String title;
  final String? subtitle;
  final Widget? leading;
  final List<Widget> trailing;
  final List<Widget> chips;

  /// Status-bar height to add above the content (0 when a parent SafeArea
  /// already handles it).
  final double topInset;
  final double side;

  @override
  Widget build(BuildContext context) {
    return MeshHeroBackground(
      radius: const BorderRadius.vertical(bottom: Radius.circular(30)),
      child: Padding(
        padding: EdgeInsets.fromLTRB(side, 14 + topInset, side, 18),
        child: SizedBox(
          height: kListHeroHeight - 32,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (leading != null) leading!,
                  const Spacer(),
                  for (var i = 0; i < trailing.length; i++) ...[
                    if (i > 0) const SizedBox(width: 8),
                    trailing[i],
                  ],
                ],
              ),
              const SizedBox(height: 14),
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.display(size: 25, color: Colors.white),
              ),
              if (subtitle != null && subtitle!.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  subtitle!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 12.5,
                    weight: FontWeight.w600,
                    color: Colors.white.withValues(alpha: 0.88),
                  ),
                ),
              ],
              const Spacer(),
              if (chips.isNotEmpty)
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (var i = 0; i < chips.length; i++) ...[
                        if (i > 0) const SizedBox(width: 8),
                        chips[i],
                      ],
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
