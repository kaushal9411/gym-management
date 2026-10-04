import 'dart:typed_data';

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
import '../../../core/utils/profile_photo.dart';
import '../../../models/member_profile_form.dart';
import '../../../models/member_self_profile.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/motion.dart';
import '../../../shared/widgets/user_avatar.dart';
import 'member_edit_profile_screen.dart' show formatProfileDate;
import 'member_menu_screen.dart';
import 'widgets/member_photo_sheet.dart';

/// Picks a photo and returns its bytes (null = cancelled). Injectable so
/// widget tests never touch the platform channel.
typedef MemberPhotoPicker = Future<Uint8List?> Function(ImageSource source);

/// Default picker. Compression strategy (no extra package): the picker
/// itself downsizes to fit 512x512 and re-encodes JPEG at quality 85, which
/// keeps a photo far below the server's ~740 KB decoded cap. The picker
/// preserves aspect ratio (no square centre-crop without an image package);
/// the avatar is rendered with `BoxFit.cover` in a circle, so framing is
/// identical on screen. `buildPhotoDataUrl` still refuses anything over the
/// payload cap or not JPEG/PNG/WebP before it is uploaded.
Future<Uint8List?> pickMemberPhoto(ImageSource source) async {
  final picked = await ImagePicker().pickImage(
    source: source,
    maxWidth: 512,
    maxHeight: 512,
    imageQuality: 85,
  );
  return picked?.readAsBytes();
}

/// Design frame "8e. Profile", redesigned for self-service editing
/// (`GET /portal/profile`): large avatar with a camera badge (take / choose /
/// remove photo -> `POST|DELETE /portal/profile/photo`), an "Edit profile"
/// action (-> [MemberEditProfileScreen]), read-only "Managed by your gym"
/// data, plus the existing My data / Security / Log out blocks.
///
/// Dropped: QR code (the profile endpoint returns a QR image URL, but the
/// app has no QR display surface for members and check-in is staff-side).
/// Photo updates are optimistic for the avatar only (the picked image shows
/// at once and reverts on failure); every other value renders from the
/// server response.
class MemberProfileScreen extends StatefulWidget {
  const MemberProfileScreen({super.key, this.photoPicker = pickMemberPhoto});

  final MemberPhotoPicker photoPicker;

  @override
  State<MemberProfileScreen> createState() => _MemberProfileScreenState();
}

class _MemberProfileScreenState extends State<MemberProfileScreen> {
  MemberSelfProfile? _profile;
  bool _loading = true;
  String? _error;

  /// Data URL of a just-picked photo, shown while it uploads.
  String? _preview;
  bool _removedPending = false;
  bool _uploading = false;
  double? _progress;

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
      final profile = await getIt<MemberPortalRepository>().selfProfile();
      if (!mounted) return;
      setState(() => _profile = profile);
      await _syncSession(profile);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _syncSession(MemberSelfProfile p) =>
      context.read<SessionCubit>().memberProfileChanged(
            name: p.name,
            email: p.email,
            profilePhotoUrl: p.profilePhotoUrl,
            clearPhoto: p.profilePhotoUrl == null,
          );

  void _toast(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _onCameraTap() async {
    if (_uploading) return;
    final profile = _profile;
    if (profile == null) return;
    final action = await showMemberPhotoSheet(context,
        hasPhoto: profile.profilePhotoUrl != null,);
    if (action == null || !mounted) return;
    switch (action) {
      case MemberPhotoAction.camera:
        await _pickAndUpload(ImageSource.camera);
      case MemberPhotoAction.gallery:
        await _pickAndUpload(ImageSource.gallery);
      case MemberPhotoAction.remove:
        await _remove();
    }
  }

  Future<void> _pickAndUpload(ImageSource source) async {
    final Uint8List? bytes;
    try {
      bytes = await widget.photoPicker(source);
    } catch (_) {
      if (!mounted) return;
      _toast(
          'Could not open the ${source == ImageSource.camera ? 'camera' : 'gallery'}. '
          'Check the app\'s permissions and try again.');
      return;
    }
    if (bytes == null || !mounted) return;
    final String dataUrl;
    try {
      dataUrl = buildPhotoDataUrl(bytes);
    } on ProfilePhotoException catch (e) {
      _toast(e.message);
      return;
    }
    setState(() {
      _preview = dataUrl;
      _uploading = true;
      _progress = 0;
    });
    try {
      final url = await getIt<MemberPortalRepository>().uploadPhoto(
        dataUrl,
        onProgress: (f) {
          if (mounted) setState(() => _progress = f);
        },
      );
      if (!mounted) return;
      final base = _profile!;
      final refreshed = await _refetchOr(base, url);
      if (!mounted) return;
      setState(() {
        _profile = refreshed;
        _preview = null;
      });
      await _syncSession(refreshed);
      if (mounted) _toast('Photo updated');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _preview = null);
      _toast(e.message);
    } finally {
      if (mounted) {
        setState(() {
          _uploading = false;
          _progress = null;
        });
      }
    }
  }

  /// Prefer the server's profile after an upload; if that read fails keep
  /// the old profile but with the new photo URL.
  Future<MemberSelfProfile> _refetchOr(
    MemberSelfProfile base,
    String? url,
  ) async {
    try {
      return await getIt<MemberPortalRepository>().selfProfile();
    } on ApiException {
      return base.copyWithPhoto(url);
    }
  }

  Future<void> _remove() async {
    setState(() {
      _uploading = true;
      _removedPending = true;
    });
    try {
      await getIt<MemberPortalRepository>().removePhoto();
      if (!mounted) return;
      final updated = _profile!.copyWithPhoto(null);
      setState(() => _profile = updated);
      await _syncSession(updated);
      if (mounted) _toast('Photo removed');
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(e.message);
    } finally {
      if (mounted) {
        setState(() {
          _uploading = false;
          _removedPending = false;
        });
      }
    }
  }

  Future<void> _edit() async {
    final profile = _profile;
    if (profile == null) return;
    final updated = await context
        .push<MemberSelfProfile>(AppRoutes.memberEditProfile, extra: profile);
    if (updated != null && mounted) setState(() => _profile = updated);
  }

  @override
  Widget build(BuildContext context) {
    final profile = _profile;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Profile', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: _loading && profile == null
            ? const AppLoadingView(role: AppRole.member)
            : _error != null && profile == null
                ? AppErrorView(
                    message: _error!,
                    onRetry: _load,
                    role: AppRole.member,
                  )
                : profile == null
                    ? const SizedBox.shrink()
                    : RefreshIndicator(
                        color: AppColors.memberB,
                        backgroundColor: AppColors.surface2,
                        onRefresh: _load,
                        child: _buildBody(profile),
                      ),
      ),
    );
  }

  Widget _buildBody(MemberSelfProfile profile) {
    final locked = profile.locked;
    final photoUrl =
        _removedPending ? null : (_preview ?? profile.profilePhotoUrl);
    final about = <(String, String)>[
      if (profile.email != null) ('Email', profile.email!),
      if (profile.phone != null) ('Phone', profile.phone!),
      if (profile.dateOfBirth != null)
        ('Birthday', formatProfileDate(profile.dateOfBirth!)),
      if (profile.gender != null)
        ('Gender', optionLabel(genderOptions, profile.gender!)),
      if (profile.goal != null)
        ('Goal', optionLabel(goalOptions, profile.goal!)),
      if (profile.bloodGroup != null)
        ('Blood group', optionLabel(bloodGroupOptions, profile.bloodGroup!)),
      if (profile.height != null)
        ('Height', '${formatMeasure(profile.height)} cm'),
      if (profile.weight != null)
        ('Weight', '${formatMeasure(profile.weight)} kg'),
    ];

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        StaggeredReveal(
          child: Container(
            padding: const EdgeInsets.fromLTRB(18, 22, 18, 18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0x24C6F135), Color(0x1A14E0B4)],
              ),
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(color: AppColors.glassBorder),
            ),
            child: Column(
              children: [
                _AvatarWithBadge(
                  photoUrl: photoUrl,
                  name: profile.name,
                  uploading: _uploading,
                  progress: _progress,
                  onCameraTap: _onCameraTap,
                ),
                const SizedBox(height: 14),
                Text(
                  profile.name,
                  textAlign: TextAlign.center,
                  style: AppText.display(size: 22),
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    profile.memberId,
                    if (locked.branchName != null) locked.branchName!,
                  ].join(' · '),
                  textAlign: TextAlign.center,
                  style: AppText.body(size: 12, color: AppColors.inkFaint),
                ),
                const SizedBox(height: 14),
                AppButton(
                  label: 'Edit profile',
                  icon: Icons.edit_outlined,
                  role: AppRole.member,
                  onPressed: _edit,
                ),
              ],
            ),
          ),
        ),
        if (about.isNotEmpty) ...[
          const SizedBox(height: 12),
          StaggeredReveal(
            index: 1,
            child: _Card(
              title: 'About you',
              child: Column(
                children: [
                  for (final r in about) _Row(label: r.$1, value: r.$2),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 12),
        StaggeredReveal(
          index: 2,
          child: _Card(
            title: 'Managed by your gym',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Row(label: 'Member ID', value: profile.memberId),
                if (locked.status.isNotEmpty)
                  _Row(label: 'Status', value: locked.status),
                if (locked.joiningDate != null)
                  _Row(
                    label: 'Joined',
                    value: formatProfileDate(locked.joiningDate!),
                  ),
                if (locked.branchName != null)
                  _Row(label: 'Branch', value: locked.branchName!),
                if (locked.trainerName != null)
                  _Row(label: 'Trainer', value: locked.trainerName!),
                if (locked.planName != null)
                  _Row(label: 'Plan', value: locked.planName!),
                if (locked.membershipEndDate != null)
                  _Row(
                    label: 'Plan ends',
                    value: formatProfileDate(locked.membershipEndDate!),
                  ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(
                      Icons.lock_outline_rounded,
                      size: 14,
                      color: AppColors.inkFaint,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Ask the front desk to change these.',
                        style: AppText.body(
                          size: 12,
                          weight: FontWeight.w600,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        StaggeredReveal(
          index: 3,
          child: _Card(
            title: 'My data',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'See everything FitCloud stores about you.',
                  style: AppText.body(
                    size: 13,
                    weight: FontWeight.w600,
                    color: AppColors.inkSoft,
                  ),
                ),
                const SizedBox(height: 10),
                AppButton(
                  label: 'Download my data',
                  role: AppRole.member,
                  variant: AppButtonVariant.ghost,
                  size: AppButtonSize.small,
                  onPressed: () => context.push(AppRoutes.memberDataExport),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        StaggeredReveal(
          index: 4,
          child: _Card(
            title: 'Security',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Change the password you use to sign in.',
                  style: AppText.body(
                    size: 13,
                    weight: FontWeight.w600,
                    color: AppColors.inkSoft,
                  ),
                ),
                const SizedBox(height: 10),
                AppButton(
                  label: 'Change password',
                  role: AppRole.member,
                  variant: AppButtonVariant.ghost,
                  size: AppButtonSize.small,
                  onPressed: () => context.push(AppRoutes.memberChangePassword),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        AppButton(
          label: 'Log out',
          role: AppRole.member,
          variant: AppButtonVariant.ghost,
          foregroundColor: AppColors.danger,
          onPressed: () => showMemberLogoutDialog(context),
        ),
      ],
    );
  }
}

class _AvatarWithBadge extends StatelessWidget {
  const _AvatarWithBadge({
    required this.photoUrl,
    required this.name,
    required this.uploading,
    required this.progress,
    required this.onCameraTap,
  });

  final String? photoUrl;
  final String name;
  final bool uploading;
  final double? progress;
  final VoidCallback onCameraTap;

  static const _size = 104.0;

  @override
  Widget build(BuildContext context) {
    final duration = reduceMotion(context)
        ? Duration.zero
        : const Duration(milliseconds: 250);
    return SizedBox(
      width: _size + 12,
      height: _size + 12,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            left: 0,
            top: 0,
            child: Container(
              padding: const EdgeInsets.all(3),
              decoration: const BoxDecoration(
                gradient: AppColors.memberGrad,
                shape: BoxShape.circle,
              ),
              child: Semantics(
                label: 'Profile photo',
                image: true,
                child: AnimatedSwitcher(
                  duration: duration,
                  child: UserAvatar(
                    key: ValueKey(photoUrl ?? 'initials'),
                    avatarUrl: photoUrl,
                    name: name,
                    size: _size - 6,
                    role: AppRole.member,
                  ),
                ),
              ),
            ),
          ),
          if (uploading)
            Positioned.fill(
              child: Padding(
                padding: const EdgeInsets.only(right: 12, bottom: 12),
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    color: Color(0x88000000),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: SizedBox(
                      width: 34,
                      height: 34,
                      child: CircularProgressIndicator(
                        strokeWidth: 3,
                        color: AppColors.memberA,
                        value:
                            (progress != null && progress! > 0 && progress! < 1)
                                ? progress
                                : null,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          // 48dp tap area, visually a 34dp badge in the avatar's corner.
          Positioned(
            right: -6,
            bottom: -6,
            child: Semantics(
              button: true,
              label: 'Change profile photo',
              child: Material(
                color: Colors.transparent,
                child: InkResponse(
                  onTap: uploading ? null : onCameraTap,
                  radius: 28,
                  child: SizedBox(
                    width: 56,
                    height: 56,
                    child: Center(
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          gradient: AppColors.memberGrad,
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.bg, width: 2),
                        ),
                        child: const Icon(
                          Icons.photo_camera_rounded,
                          size: 18,
                          color: AppColors.memberOnGrad,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppText.eyebrow()),
          const SizedBox(height: 6),
          child,
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppText.body(
              size: 13,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: AppText.body(size: 13, weight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
