import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'app_top_bar.dart';

/// Mirrors tenant-web's `components/coming-soon.tsx` — every nav destination
/// resolves to something real, even before its module is built, rather than
/// a dead tab or a 404.
class ComingSoonPage extends StatelessWidget {
  final String title;
  final IconData icon;

  const ComingSoonPage({super.key, required this.title, required this.icon});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppTopBar(caption: 'Coming soon', title: title),
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(icon, size: 40, color: colors.inkFaint),
                      const SizedBox(height: 12),
                      Text(
                        '$title is on the way',
                        style: TextStyle(color: colors.inkFaint),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
