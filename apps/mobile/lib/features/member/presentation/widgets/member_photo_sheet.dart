import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';

enum MemberPhotoAction { camera, gallery, remove }

/// Bottom sheet behind the avatar's camera badge. "Remove photo" is only
/// offered when a photo exists. Rows are 56dp tall (>= 48dp tap targets) and
/// use Material + InkWell. Resolves to null when dismissed.
Future<MemberPhotoAction?> showMemberPhotoSheet(
  BuildContext context, {
  required bool hasPhoto,
}) {
  return showModalBottomSheet<MemberPhotoAction>(
    context: context,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
    ),
    builder: (sheetContext) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 14, 8, 10),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.only(left: 12, bottom: 6),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('Profile photo', style: AppText.eyebrow()),
              ),
            ),
            _SheetRow(
              icon: Icons.photo_camera_outlined,
              label: 'Take photo',
              onTap: () =>
                  Navigator.of(sheetContext).pop(MemberPhotoAction.camera),
            ),
            _SheetRow(
              icon: Icons.photo_library_outlined,
              label: 'Choose from gallery',
              onTap: () =>
                  Navigator.of(sheetContext).pop(MemberPhotoAction.gallery),
            ),
            if (hasPhoto)
              _SheetRow(
                icon: Icons.delete_outline_rounded,
                label: 'Remove photo',
                color: AppColors.danger,
                onTap: () =>
                    Navigator.of(sheetContext).pop(MemberPhotoAction.remove),
              ),
          ],
        ),
      ),
    ),
  );
}

class _SheetRow extends StatelessWidget {
  const _SheetRow({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color = AppColors.ink,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.field),
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                Icon(icon, size: 22, color: color),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    label,
                    style: AppText.body(
                      size: 15,
                      weight: FontWeight.w700,
                      color: color,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
