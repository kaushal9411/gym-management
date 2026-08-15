import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/staff_profile.dart';
import '../../../repositories/profile_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/user_avatar.dart';

class _MenuEntry {
  const _MenuEntry({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.route,
    this.danger = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? route;
  final bool danger;
}

const _entries = [
  _MenuEntry(
    icon: Icons.person_outline_rounded,
    title: 'Profile data',
    subtitle: 'Name, phone',
    route: AppRoutes.profileData,
  ),
  _MenuEntry(
    icon: Icons.emergency_outlined,
    title: 'Emergency contact',
    subtitle: 'Who to call, and how',
    route: AppRoutes.profileEmergencyContact,
  ),
  _MenuEntry(
    icon: Icons.notifications_outlined,
    title: 'Notification preferences',
    subtitle: 'What you get notified about',
    route: AppRoutes.profileNotifications,
  ),
  _MenuEntry(
    icon: Icons.lock_outline_rounded,
    title: 'Change password',
    subtitle: 'Signs out other devices',
    route: AppRoutes.profileChangePassword,
  ),
  _MenuEntry(
    icon: Icons.shield_outlined,
    title: 'Check permissions',
    subtitle: 'Your role and what it can do',
    route: AppRoutes.profilePermissions,
  ),
  _MenuEntry(
    icon: Icons.logout_rounded,
    title: 'Log out',
    subtitle: 'End this session',
    danger: true,
  ),
];

/// The header avatar circle (Owner/Manager/Trainer/Receptionist — every
/// staff menu/dashboard screen) opens here. A hub, mirroring
/// `GymSettingsScreen`'s pattern: this screen shows the photo + identity
/// header and holds no editable fields itself — each menu row owns one
/// slice of `ProfileDto` and does its own `GET/PATCH /profile` round trip.
class MyProfileScreen extends StatefulWidget {
  const MyProfileScreen({super.key});

  @override
  State<MyProfileScreen> createState() => _MyProfileScreenState();
}

class _MyProfileScreenState extends State<MyProfileScreen> {
  StaffProfile? _profile;
  bool _loading = true;
  String? _error;
  bool _uploadingPhoto = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final profile = await getIt<ProfileRepository>().getProfile();
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  /// Pushes [route] and refreshes on return, since the sub-screen may have
  /// changed a field this hub displays (name, phone) or that another row
  /// depends on.
  Future<void> _openSection(String route) async {
    await context.push(route);
    if (mounted) _load();
  }

  Future<void> _pickPhoto(ImageSource source) async {
    final picked = await ImagePicker().pickImage(
      source: source,
      maxWidth: 192,
      maxHeight: 192,
      imageQuality: 85,
    );
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    if (!mounted) return;
    setState(() => _uploadingPhoto = true);
    try {
      final updated = await getIt<ProfileRepository>()
          .updateAvatar('data:image/jpeg;base64,${base64Encode(bytes)}');
      if (!mounted) return;
      setState(() => _profile = updated);
      await context.read<SessionCubit>().refreshStaffUser();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  Future<void> _removePhoto() async {
    setState(() => _uploadingPhoto = true);
    try {
      final updated = await getIt<ProfileRepository>().updateAvatar(null);
      if (!mounted) return;
      setState(() => _profile = updated);
      await context.read<SessionCubit>().refreshStaffUser();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  void _showPhotoOptions() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface2,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            _PhotoOptionTile(
              icon: Icons.photo_camera_outlined,
              label: 'Take a photo',
              onTap: () {
                Navigator.pop(sheetContext);
                _pickPhoto(ImageSource.camera);
              },
            ),
            _PhotoOptionTile(
              icon: Icons.photo_library_outlined,
              label: 'Choose from gallery',
              onTap: () {
                Navigator.pop(sheetContext);
                _pickPhoto(ImageSource.gallery);
              },
            ),
            if (_profile?.avatarUrl != null && _profile!.avatarUrl!.isNotEmpty)
              _PhotoOptionTile(
                icon: Icons.delete_outline_rounded,
                label: 'Remove photo',
                color: AppColors.danger,
                onTap: () {
                  Navigator.pop(sheetContext);
                  _removePhoto();
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: AppColors.surface2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.card),
        ),
        title: Text('Log out of FitCloud?', style: AppText.display(size: 18)),
        content: Text(
          "You'll need your email and password to sign back in.",
          style: AppText.body(size: 13, color: AppColors.inkFaint),
        ),
        actions: [
          TextButton(
            onPressed: () => dialogContext.pop(false),
            child: Text(
              'Cancel',
              style: AppText.body(size: 13, weight: FontWeight.w700),
            ),
          ),
          TextButton(
            onPressed: () => dialogContext.pop(true),
            child: Text(
              'Log out',
              style: AppText.body(
                size: 13,
                weight: FontWeight.w700,
                color: AppColors.danger,
              ),
            ),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await context.read<SessionCubit>().signOut();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('My Profile', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const AppLoadingView()
            : _profile == null
                ? AppErrorView(message: _error!, onRetry: _load)
                : ListView(
                    padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                    children: [
                      Center(
                        child: _AvatarPicker(
                          avatarUrl: _profile!.avatarUrl,
                          initials: _profile!.name,
                          loading: _uploadingPhoto,
                          onTap: _showPhotoOptions,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Center(
                        child: Text(
                          _profile!.name,
                          style: AppText.display(size: 18),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Center(
                        child: Text(
                          _profile!.email,
                          style: AppText.body(
                            size: 12.5,
                            color: AppColors.inkFaint,
                            weight: FontWeight.w600,
                          ),
                        ),
                      ),
                      if (_profile!.phone != null &&
                          _profile!.phone!.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Center(
                          child: Text(
                            _profile!.phone!,
                            style: AppText.body(
                              size: 12.5,
                              color: AppColors.inkFaint,
                              weight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 24),
                      for (final entry in _entries)
                        _MenuTile(
                          entry: entry,
                          onTap: entry.danger
                              ? _confirmLogout
                              : () => _openSection(entry.route!),
                        ),
                    ],
                  ),
      ),
    );
  }
}

class _AvatarPicker extends StatelessWidget {
  const _AvatarPicker({
    required this.avatarUrl,
    required this.initials,
    required this.loading,
    required this.onTap,
  });

  final String? avatarUrl;
  final String initials;
  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: loading ? null : onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          UserAvatar(avatarUrl: avatarUrl, name: initials, size: 88),
          if (loading)
            Container(
              width: 88,
              height: 88,
              decoration: const BoxDecoration(
                color: Colors.black45,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              ),
            ),
          Positioned(
            right: -2,
            bottom: -2,
            child: Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                gradient: AppColors.staffGrad,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.bg, width: 3),
              ),
              alignment: Alignment.center,
              child: const Icon(
                Icons.camera_alt_rounded,
                size: 14,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PhotoOptionTile extends StatelessWidget {
  const _PhotoOptionTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: color ?? AppColors.ink),
      title: Text(
        label,
        style: AppText.body(
          size: 14,
          weight: FontWeight.w600,
          color: color ?? AppColors.ink,
        ),
      ),
      onTap: onTap,
    );
  }
}

/// Same tile chrome as `GymSettingsScreen`'s `_SettingsTile` — "Log out"
/// swaps the icon tile and label to the danger tone instead of a chevron
/// row, since it's an action, not a drill-down.
class _MenuTile extends StatelessWidget {
  const _MenuTile({required this.entry, required this.onTap});

  final _MenuEntry entry;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(
                color: entry.danger
                    ? AppColors.danger.withValues(alpha: 0.3)
                    : AppColors.line,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: entry.danger
                        ? AppColors.dangerSoft
                        : AppColors.staffSoft,
                    borderRadius: BorderRadius.circular(AppRadii.tile),
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    entry.icon,
                    size: 18,
                    color:
                        entry.danger ? AppColors.danger : AppColors.staffPillFg,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        entry.title,
                        style: AppText.body(
                          size: 13,
                          weight: FontWeight.w700,
                          color:
                              entry.danger ? AppColors.danger : AppColors.ink,
                        ),
                      ),
                      Text(
                        entry.subtitle,
                        style: AppText.body(
                          size: 11,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!entry.danger)
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 18,
                    color: AppColors.inkFaint,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
