import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/staff_profile.dart';
import '../../../repositories/auth_repository.dart';
import '../../../repositories/profile_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

const _preferenceLabels = <String, String>{
  'email_billing': 'Billing & subscription emails',
  'email_announcements': 'Platform announcements',
  'inapp_system': 'In-app system alerts',
};

/// The header avatar circle (Owner/Manager/Trainer/Receptionist — every
/// staff menu/dashboard screen) now opens here. Mirrors `apps/tenant-web`'s
/// `/profile` page (`GET/PATCH /profile`): photo, editable fields (every
/// field except email — the backend requires `users:manage` to change
/// that), notification prefs, a change-password section
/// (`PATCH /auth/change-password`), and a read-only roles/permissions view
/// sourced from the session's own `/auth/me` data.
class MyProfileScreen extends StatefulWidget {
  const MyProfileScreen({super.key});

  @override
  State<MyProfileScreen> createState() => _MyProfileScreenState();
}

class _MyProfileScreenState extends State<MyProfileScreen> {
  StaffProfile? _profile;
  bool _loading = true;
  String? _loadError;

  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _ecNameController;
  late final TextEditingController _ecPhoneController;
  late final TextEditingController _ecRelationController;
  String? _avatarUrl;
  Map<String, bool> _prefs = {};

  bool _savingProfile = false;
  String? _profileError;

  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _changingPassword = false;
  String? _passwordError;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController();
    _phoneController = TextEditingController();
    _ecNameController = TextEditingController();
    _ecPhoneController = TextEditingController();
    _ecRelationController = TextEditingController();
    _load();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _ecNameController.dispose();
    _ecPhoneController.dispose();
    _ecRelationController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final profile = await getIt<ProfileRepository>().getProfile();
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _nameController.text = profile.name;
        _phoneController.text = profile.phone ?? '';
        _ecNameController.text = profile.emergencyContact.name ?? '';
        _ecPhoneController.text = profile.emergencyContact.phone ?? '';
        _ecRelationController.text = profile.emergencyContact.relation ?? '';
        _avatarUrl = profile.avatarUrl;
        _prefs = {...profile.notificationPreferences};
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = e.message;
        _loading = false;
      });
    }
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
    setState(() => _avatarUrl = 'data:image/jpeg;base64,${base64Encode(bytes)}');
  }

  void _showPhotoOptions() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface2,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
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
            if (_avatarUrl != null && _avatarUrl!.isNotEmpty)
              _PhotoOptionTile(
                icon: Icons.delete_outline_rounded,
                label: 'Remove photo',
                color: AppColors.danger,
                onTap: () {
                  Navigator.pop(sheetContext);
                  setState(() => _avatarUrl = null);
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Future<void> _saveProfile() async {
    final name = _nameController.text.trim();
    if (name.length < 2) {
      setState(() => _profileError = 'Full name is required');
      return;
    }
    setState(() {
      _savingProfile = true;
      _profileError = null;
    });
    try {
      final updated = await getIt<ProfileRepository>().updateProfile(
        name: name,
        phone: _phoneController.text.trim().isEmpty
            ? null
            : _phoneController.text.trim(),
        avatarUrl: _avatarUrl,
        emergencyContactName: _ecNameController.text.trim().isEmpty
            ? null
            : _ecNameController.text.trim(),
        emergencyContactPhone: _ecPhoneController.text.trim().isEmpty
            ? null
            : _ecPhoneController.text.trim(),
        emergencyContactRelation: _ecRelationController.text.trim().isEmpty
            ? null
            : _ecRelationController.text.trim(),
      );
      if (!mounted) return;
      setState(() => _profile = updated);
      if (!mounted) return;
      await context.read<SessionCubit>().refreshStaffUser();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Profile saved')));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _profileError = e.message);
    } finally {
      if (mounted) setState(() => _savingProfile = false);
    }
  }

  Future<void> _togglePreference(String key, bool value) async {
    final previous = {..._prefs};
    setState(() => _prefs[key] = value);
    try {
      final updated = await getIt<ProfileRepository>().updateProfile(
        name: _nameController.text.trim(),
        phone: _phoneController.text.trim().isEmpty
            ? null
            : _phoneController.text.trim(),
        avatarUrl: _avatarUrl,
        emergencyContactName: _ecNameController.text.trim().isEmpty
            ? null
            : _ecNameController.text.trim(),
        emergencyContactPhone: _ecPhoneController.text.trim().isEmpty
            ? null
            : _ecPhoneController.text.trim(),
        emergencyContactRelation: _ecRelationController.text.trim().isEmpty
            ? null
            : _ecRelationController.text.trim(),
        notificationPreferences: _prefs,
      );
      if (!mounted) return;
      setState(() => _profile = updated);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _prefs = previous);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _changePassword() async {
    final current = _currentPasswordController.text;
    final next = _newPasswordController.text;
    final confirm = _confirmPasswordController.text;
    if (current.isEmpty || next.isEmpty) {
      setState(() => _passwordError = 'Both password fields are required');
      return;
    }
    if (next != confirm) {
      setState(() => _passwordError = 'New passwords don\'t match');
      return;
    }
    setState(() {
      _changingPassword = true;
      _passwordError = null;
    });
    try {
      await getIt<AuthRepository>().changePassword(
        currentPassword: current,
        newPassword: next,
      );
      if (!mounted) return;
      _currentPasswordController.clear();
      _newPasswordController.clear();
      _confirmPasswordController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Password changed. Other devices were signed out.'),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _passwordError = e.message);
    } finally {
      if (mounted) setState(() => _changingPassword = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    final sessionUser =
        session is SessionAuthenticatedStaff ? session.user : null;

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
                ? AppErrorView(message: _loadError!, onRetry: _load)
                : ListView(
                    padding: const EdgeInsets.fromLTRB(18, 8, 18, 32),
                    children: [
                      Center(
                        child: _AvatarPicker(
                          avatarUrl: _avatarUrl,
                          initials: sessionUser?.initials ?? '?',
                          onTap: _showPhotoOptions,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Center(
                        child: Text(
                          _profile!.email,
                          style: AppText.body(
                            size: 12,
                            color: AppColors.inkFaint,
                            weight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      Text('Profile', style: AppText.eyebrow()),
                      const SizedBox(height: 10),
                      if (_profileError != null) ...[
                        FormAlert(message: _profileError!),
                        const SizedBox(height: 12),
                      ],
                      AppLabeledField(
                        label: 'Full name',
                        controller: _nameController,
                        textInputAction: TextInputAction.next,
                      ),
                      const SizedBox(height: 14),
                      AppLabeledField(
                        label: 'Phone',
                        controller: _phoneController,
                        keyboardType: TextInputType.phone,
                        textInputAction: TextInputAction.next,
                      ),
                      const SizedBox(height: 18),
                      Text('Emergency contact', style: AppText.eyebrow()),
                      const SizedBox(height: 10),
                      AppLabeledField(
                        label: 'Name',
                        controller: _ecNameController,
                        textInputAction: TextInputAction.next,
                      ),
                      const SizedBox(height: 14),
                      AppLabeledField(
                        label: 'Phone',
                        controller: _ecPhoneController,
                        keyboardType: TextInputType.phone,
                        textInputAction: TextInputAction.next,
                      ),
                      const SizedBox(height: 14),
                      AppLabeledField(
                        label: 'Relation',
                        controller: _ecRelationController,
                        textInputAction: TextInputAction.done,
                      ),
                      const SizedBox(height: 20),
                      AppButton(
                        label: 'Save changes',
                        loading: _savingProfile,
                        onPressed: _saveProfile,
                      ),
                      const SizedBox(height: 28),
                      Text('Notifications', style: AppText.eyebrow()),
                      const SizedBox(height: 10),
                      for (final entry in _prefs.entries) ...[
                        _PreferenceRow(
                          title: _preferenceLabels[entry.key] ?? entry.key,
                          value: entry.value,
                          onChanged: (v) => _togglePreference(entry.key, v),
                        ),
                        const SizedBox(height: 4),
                      ],
                      const SizedBox(height: 24),
                      Text('Security', style: AppText.eyebrow()),
                      const SizedBox(height: 10),
                      if (_passwordError != null) ...[
                        FormAlert(message: _passwordError!),
                        const SizedBox(height: 12),
                      ],
                      AppLabeledField(
                        label: 'Current password',
                        controller: _currentPasswordController,
                        obscureText: true,
                        textInputAction: TextInputAction.next,
                      ),
                      const SizedBox(height: 14),
                      AppLabeledField(
                        label: 'New password',
                        controller: _newPasswordController,
                        obscureText: true,
                        textInputAction: TextInputAction.next,
                      ),
                      const SizedBox(height: 14),
                      AppLabeledField(
                        label: 'Confirm new password',
                        controller: _confirmPasswordController,
                        obscureText: true,
                        textInputAction: TextInputAction.done,
                      ),
                      const SizedBox(height: 20),
                      AppButton(
                        label: 'Change password',
                        variant: AppButtonVariant.ghost,
                        loading: _changingPassword,
                        onPressed: _changePassword,
                      ),
                      const SizedBox(height: 28),
                      Text('Role & permissions', style: AppText.eyebrow()),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: (sessionUser?.roles ?? const [])
                            .map(
                              (r) => AppPill(
                                label: r,
                                tone: AppPillTone.roleTint,
                              ),
                            )
                            .toList(),
                      ),
                      const SizedBox(height: 12),
                      for (final group
                          in _groupPermissions(sessionUser?.permissions ?? const []))
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _PermissionGroupView(
                            resource: group.key,
                            permissions: group.value,
                          ),
                        ),
                    ],
                  ),
      ),
    );
  }
}

/// "members:read" → "members" — same grouping the role-permission picker
/// uses, applied here read-only to the current user's own granted keys.
List<MapEntry<String, List<String>>> _groupPermissions(
  List<String> permissions,
) {
  final groups = <String, List<String>>{};
  for (final key in permissions) {
    final resource = key.split(':').first;
    groups.putIfAbsent(resource, () => []).add(key);
  }
  final entries = groups.entries.toList()
    ..sort((a, b) => a.key.compareTo(b.key));
  return entries;
}

class _AvatarPicker extends StatelessWidget {
  const _AvatarPicker({
    required this.avatarUrl,
    required this.initials,
    required this.onTap,
  });

  final String? avatarUrl;
  final String initials;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          _AvatarImage(avatarUrl: avatarUrl, initials: initials, size: 88),
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

class _AvatarImage extends StatelessWidget {
  const _AvatarImage({
    required this.avatarUrl,
    required this.initials,
    required this.size,
  });

  final String? avatarUrl;
  final String initials;
  final double size;

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
          initials,
          style: AppText.body(
            size: size * 0.32,
            weight: FontWeight.w800,
            color: Colors.white,
          ),
        ),
      );
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

/// Same visual as `SecurityPolicyScreen`'s `_RoleToggleRow` / `RoleFormScreen`'s
/// `_ToggleRow` — gradient track, 26px height, white knob.
class _PreferenceRow extends StatelessWidget {
  const _PreferenceRow({
    required this.title,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: AppText.body(size: 13, weight: FontWeight.w600),
          ),
        ),
        GestureDetector(
          onTap: () => onChanged(!value),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            width: 44,
            height: 26,
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              gradient: value ? AppColors.staffGrad : null,
              color: value ? null : AppColors.surface3,
              borderRadius: BorderRadius.circular(99),
            ),
            alignment: value ? Alignment.centerRight : Alignment.centerLeft,
            child: Container(
              width: 20,
              height: 20,
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Read-only twin of `RoleFormScreen`'s `_PermissionGroupCard` — same card
/// chrome, no "Select all" pill or tap handlers since this just shows what
/// the signed-in user can already do.
class _PermissionGroupView extends StatelessWidget {
  const _PermissionGroupView({
    required this.resource,
    required this.permissions,
  });

  final String resource;
  final List<String> permissions;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            resource,
            style: AppText.body(size: 13, weight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: permissions
                .map(
                  (permission) => Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      gradient: AppColors.staffGrad,
                      borderRadius: BorderRadius.circular(AppRadii.pill),
                    ),
                    child: Text(
                      permission,
                      style: AppText.body(
                        size: 11,
                        weight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }
}
