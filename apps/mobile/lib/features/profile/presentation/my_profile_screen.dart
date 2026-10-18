import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/staff_profile.dart';
import '../../../repositories/profile_repository.dart';
import '../../../shared/widgets/adaptive_columns.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/staff_logout_dialog.dart';
import '../../owner/presentation/widgets/dash_ui.dart' show DashRing;
import '../../team/presentation/widgets/team_ui.dart';
import 'profile_logic.dart';
import 'profile_ui.dart';

/// My Profile — web's `/profile` page plus its Account Settings entry points,
/// as one hub for phone and tablet.
///
/// Header: photo (tap to take / choose / remove — `PATCH /profile`), name,
/// e-mail, role and branch pills, "Email verified". Then web's four stats
/// (Profile complete, Member since, Last sign-in, Two-factor), the
/// completeness card (a ring + the eight real checks), and the sections:
/// Personal details, Emergency contact, Notification preferences, Change
/// password, Two-factor authentication, Sessions & devices, Check permissions
/// (mobile extra, from the session), Help Center and "Your gym". Each section
/// is its own page that does its own `GET`/`PATCH /profile`; the hub reloads
/// on return. Log out sits at the bottom.
///
/// Dropped vs web: the gym's plan / timezone / currency in "Your gym" (they
/// need `settings:read`; only the name and status are known to every role).
/// Everyone can open their own profile — no permission is involved.
class MyProfileScreen extends StatefulWidget {
  const MyProfileScreen({super.key});

  @override
  State<MyProfileScreen> createState() => _MyProfileScreenState();
}

class _MyProfileScreenState extends State<MyProfileScreen> {
  StaffProfile? _profile;
  String? _error;
  bool _uploadingPhoto = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final profile = await getIt<ProfileRepository>().getProfile();
      if (!mounted) return;
      setState(() => _profile = profile);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load your profile ($e)');
    }
  }

  /// Pushes [route] and refreshes on return, since the sub-page may have
  /// changed something this hub shows (name, phone, 2FA, completeness).
  Future<void> _open(String route) async {
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
    await _savePhoto('data:image/jpeg;base64,${base64Encode(bytes)}');
  }

  Future<void> _savePhoto(String? dataUrl) async {
    setState(() => _uploadingPhoto = true);
    try {
      final updated = await getIt<ProfileRepository>().updateAvatar(dataUrl);
      if (!mounted) return;
      setState(() => _profile = updated);
      await context.read<SessionCubit>().refreshStaffUser();
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) {
        teamSnack(context, 'Could not save the photo ($e)', error: true);
      }
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  Future<void> _photoOptions() async {
    final hasPhoto = _profile?.avatarUrl?.isNotEmpty ?? false;
    final choice = await pickOneSheet(
      context,
      title: 'Profile photo',
      options: [
        ('camera', 'Take a photo'),
        ('gallery', 'Choose from gallery'),
        if (hasPhoto) ('remove', 'Remove photo'),
      ],
      current: null,
    );
    switch (choice) {
      case 'camera':
        await _pickPhoto(ImageSource.camera);
      case 'gallery':
        await _pickPhoto(ImageSource.gallery);
      case 'remove':
        await _savePhoto(null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _profile;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('My Profile'),
      ),
      body: p == null
          ? Padding(
              padding: EdgeInsets.only(
                top: MediaQuery.of(context).padding.top + kToolbarHeight,
              ),
              child: _error != null
                  ? AppErrorView(message: _error!, onRetry: _load)
                  : const AppLoadingView(),
            )
          : RefreshIndicator(
              color: AppColors.staffB,
              backgroundColor: AppColors.surface2,
              onRefresh: _load,
              child: _content(p),
            ),
    );
  }

  Widget _content(StaffProfile p) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final items = profileCompleteness(p);
    final percent = completenessPercent(items);
    final branches = p.branchAccess.allBranches
        ? const ['All branches']
        : [for (final b in p.branchAccess.branches) b.branchName];
    final session = context.watch<SessionCubit>().state;
    final tenant = session is SessionAuthenticatedStaff ? session.tenant : null;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 28),
      children: [
        TeamHero(
          topInset: top,
          name: p.name,
          subtitle: p.email,
          avatarUrl: p.avatarUrl,
          uploading: _uploadingPhoto,
          onAvatarTap: _photoOptions,
          pills: [
            for (final r in p.roles) TeamHeroPill(r),
            for (final b in branches)
              TeamHeroPill(b, icon: Icons.place_outlined),
            if (p.emailVerifiedAt != null)
              const TeamHeroPill(
                'Email verified',
                icon: Icons.check_circle_outline_rounded,
              ),
          ],
        ),
        TeamCenter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TeamSummaryGrid(
                  tiles: [
                    TeamSummaryTile(
                      index: 0,
                      icon: Icons.verified_user_outlined,
                      color: kProfileColor,
                      label: 'Profile complete',
                      number: percent,
                      suffix: '%',
                    ),
                    TeamSummaryTile(
                      index: 1,
                      icon: Icons.event_available_outlined,
                      color: TeamColors.teal,
                      label: 'Member since',
                      text: profileDate(p.createdAt, never: '—'),
                    ),
                    TeamSummaryTile(
                      index: 2,
                      icon: Icons.login_rounded,
                      color: TeamColors.amber,
                      label: 'Last sign-in',
                      text: profileDate(p.lastLoginAt),
                    ),
                    TeamSummaryTile(
                      index: 3,
                      icon: Icons.shield_outlined,
                      color: p.mfaEnabled ? TeamColors.green : TeamColors.rose,
                      label: 'Two-factor',
                      text: p.mfaEnabled ? 'On' : 'Off',
                      onTap: () => _open(AppRoutes.profileSecurity),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                AdaptiveColumns(
                  children: [
                    _completeness(items, percent),
                    _sections(),
                  ],
                ),
                if (tenant != null) ...[
                  const SizedBox(height: 14),
                  TeamSectionCard(
                    icon: Icons.storefront_rounded,
                    color: TeamColors.sky,
                    title: 'Your gym',
                    subtitle: 'Workspace this account belongs to.',
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              tenant.name,
                              style: AppText.display(size: 17),
                            ),
                          ),
                          TeamTag(
                            label: tenant.status.replaceAll('_', ' '),
                            color: tenant.status == 'ACTIVE'
                                ? TeamColors.green
                                : TeamColors.amber,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                _logout(),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _completeness(List<CompletenessItem> items, int percent) {
    final done = items.where((i) => i.done).length;
    return TeamSectionCard(
      icon: Icons.verified_user_outlined,
      color: kProfileColor,
      title: 'Completeness',
      subtitle: 'Based on your saved details',
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            Row(
              children: [
                DashRing(
                  size: 84,
                  thickness: 10,
                  segments: [percent / 100],
                  colors: [percent == 100 ? TeamColors.green : kProfileColor],
                  trackColor: AppColors.surface3,
                  semanticLabel: 'Profile $percent percent complete',
                  child: Text(
                    '$percent%',
                    style: AppText.display(size: 17),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        percent == 100
                            ? 'Profile complete'
                            : 'Profile completeness',
                        style: AppText.body(size: 14, weight: FontWeight.w800),
                      ),
                      Text(
                        '$done of ${items.length} details filled in',
                        style: AppText.body(
                          size: 12,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            for (final i in items)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  children: [
                    Icon(
                      i.done
                          ? Icons.check_circle_rounded
                          : Icons.radio_button_unchecked_rounded,
                      size: 17,
                      color: i.done ? TeamColors.green : AppColors.inkFaint,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        i.label,
                        style: AppText.body(
                          size: 12.5,
                          weight: FontWeight.w600,
                          color: i.done ? AppColors.ink : AppColors.inkFaint,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _sections() {
    Widget tile(
      IconData icon,
      String label,
      String hint,
      String route,
      Color color,
    ) =>
        TeamActionTile(
          icon: icon,
          label: label,
          hint: hint,
          color: color,
          onTap: () => _open(route),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TeamSectionCard(
          icon: Icons.person_outline_rounded,
          color: kProfileColor,
          title: 'Personal',
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
            child: Column(
              children: [
                tile(
                  Icons.badge_outlined,
                  'Personal details',
                  'Name and phone',
                  AppRoutes.profileData,
                  kProfileColor,
                ),
                tile(
                  Icons.emergency_outlined,
                  'Emergency contact',
                  'Who to call, and how',
                  AppRoutes.profileEmergencyContact,
                  TeamColors.amber,
                ),
                tile(
                  Icons.notifications_outlined,
                  'Notification preferences',
                  'What you get notified about',
                  AppRoutes.profileNotifications,
                  TeamColors.sky,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        TeamSectionCard(
          icon: Icons.lock_outline_rounded,
          color: TeamColors.indigo,
          title: 'Security & help',
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
            child: Column(
              children: [
                tile(
                  Icons.key_rounded,
                  'Change password',
                  'Signs out other devices',
                  AppRoutes.profileChangePassword,
                  TeamColors.indigo,
                ),
                tile(
                  Icons.shield_outlined,
                  'Two-factor authentication',
                  'Authenticator app and backup codes',
                  AppRoutes.profileSecurity,
                  TeamColors.green,
                ),
                tile(
                  Icons.devices_rounded,
                  'Sessions & devices',
                  "Where you're signed in",
                  AppRoutes.sessions,
                  TeamColors.teal,
                ),
                tile(
                  Icons.admin_panel_settings_outlined,
                  'Check permissions',
                  'Your role and what it can do',
                  AppRoutes.profilePermissions,
                  TeamColors.violet,
                ),
                tile(
                  Icons.help_outline_rounded,
                  'Help Center',
                  'Guides & tickets',
                  AppRoutes.support,
                  TeamColors.fuchsia,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _logout() => Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: () => showStaffLogoutDialog(context),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.dangerSoft,
              borderRadius: BorderRadius.circular(AppRadii.card),
              border:
                  Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                Icon(Icons.logout_rounded, color: AppColors.danger),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Log out',
                    style: AppText.body(
                      size: 13.5,
                      weight: FontWeight.w800,
                      color: AppColors.danger,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}
