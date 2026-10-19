import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../bloc/platform/platform_config_cubit.dart';
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
import '../../manager/presentation/widgets/member_detail_anim.dart'
    show Looping;
import '../../team/presentation/widgets/team_ui.dart'
    show TeamCenter, TeamColors;
import 'member_menu_screen.dart';
import 'member_profile_logic.dart';
import 'widgets/member_dash_ui.dart';
import 'widgets/member_profile_blocks.dart';
import 'widgets/member_photo_sheet.dart';
import 'widgets/member_plan_benefits.dart';

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

/// My Profile — web's `/portal/profile`, animated, in the member palette.
///
/// An animated hero (drifting gradient, a rotating lime-to-teal ring around
/// the photo that springs in, name, member ID · branch, status / plan chips,
/// **Edit profile** and the **Check-in QR** dialog); the camera badge takes /
/// chooses / removes the photo (`POST|DELETE /portal/profile/photo`). Then
/// web's profile-completeness ring with its ten real checks as chips (tap a
/// missing one to edit), Plan / Member since / Trainer tiles, the **What's
/// included** plan card (`GET /portal/plan`: every benefit of the current plan
/// with usage vs quota), **About you**,
/// **Fitness**, **Contact details** (address + emergency contact) — only the
/// fields that are set — **Managed by your gym** (read-only), **Security &
/// data** (change password, download my data) and Log out. Everything staggers
/// in; all motion collapses under reduced-motion. Editing happens on
/// [MemberEditProfileScreen] (`PATCH /portal/profile`).
///
/// The photo upload is optimistic for the avatar only (the picked image shows
/// at once and reverts on failure); every other value renders from the server
/// response.
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

  /// Bumped on every (re)load so the plan-benefits block refetches with it.
  int _planEpoch = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _planEpoch++;
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
    final action = await showMemberPhotoSheet(
      context,
      hasPhoto: profile.profilePhotoUrl != null,
    );
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

  void _showQr(String url) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.card),
        ),
        title: Text('Check-in QR code', style: AppText.display(size: 18)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Show this at the front desk to check in.',
              style: AppText.body(size: 12.5, color: AppColors.inkFaint),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
              ),
              child: memberQrImage(url),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final profile = _profile;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: _loading && profile == null
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
    );
  }

  // One key per block so a completeness chip can open the right form.
  final _blockKeys = <String, GlobalKey<ProfileBlockState>>{
    'personal': GlobalKey<ProfileBlockState>(),
    'contact': GlobalKey<ProfileBlockState>(),
    'address': GlobalKey<ProfileBlockState>(),
    'emergency': GlobalKey<ProfileBlockState>(),
    'fitness': GlobalKey<ProfileBlockState>(),
  };

  /// Which block owns a completeness check (the photo has its own flow).
  static const _checkBlock = {
    'phone': 'contact',
    'email': 'contact',
    'date of birth': 'personal',
    'gender': 'personal',
    'address': 'address',
    'emergency contact': 'emergency',
    'fitness goal': 'fitness',
    'height & weight': 'fitness',
    'blood group': 'fitness',
  };

  void _openCheck(String label) {
    if (label == 'photo') {
      _onCameraTap();
      return;
    }
    final key = _blockKeys[_checkBlock[label]];
    final state = key?.currentState;
    if (state == null) return;
    state.startEditing();
    final ctx = key!.currentContext;
    if (ctx != null) {
      Scrollable.ensureVisible(
        ctx,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOutCubic,
        alignment: 0.1,
      );
    }
  }

  Future<void> _blockSaved(MemberSelfProfile updated) async {
    setState(() => _profile = updated);
    await _syncSession(updated);
    if (mounted) _toast('Profile updated');
  }

  Widget _buildBody(MemberSelfProfile profile) {
    final appName = context.watch<PlatformConfigCubit>().state.appName;
    final locked = profile.locked;
    final photoUrl =
        _removedPending ? null : (_preview ?? profile.profilePhotoUrl);
    final checks = memberProfileChecks(profile);
    final pct = memberProfilePercent(checks);
    final hint = memberProfileHint(checks);
    final qr = profile.qrCodeImageUrl;
    final top = MediaQuery.of(context).padding.top;

    final personal = <ProfileRowData>[
      ProfileRowData(
        Icons.badge_outlined,
        'Name',
        '${profile.firstName} ${profile.lastName}'.trim(),
      ),
      if (profile.dateOfBirth != null)
        ProfileRowData(
          Icons.cake_outlined,
          'Birthday',
          formatProfileDate(profile.dateOfBirth!),
        ),
      if (profile.gender != null)
        ProfileRowData(
          Icons.person_outline_rounded,
          'Gender',
          optionLabel(genderOptions, profile.gender!),
        ),
      if (profile.maritalStatus != null)
        ProfileRowData(
          Icons.favorite_border_rounded,
          'Marital status',
          optionLabel(maritalOptions, profile.maritalStatus!),
        ),
      if (profile.anniversary != null)
        ProfileRowData(
          Icons.celebration_outlined,
          'Anniversary',
          formatProfileDate(profile.anniversary!),
        ),
    ];
    final contact = <ProfileRowData>[
      if (profile.phone != null)
        ProfileRowData(Icons.call_outlined, 'Phone', profile.phone!),
      if (profile.email != null)
        ProfileRowData(Icons.mail_outline_rounded, 'Email', profile.email!),
    ];
    final a = profile.address;
    final addressRows = <ProfileRowData>[
      if (a.addressLine != null)
        ProfileRowData(Icons.home_outlined, 'Address line', a.addressLine!),
      if (a.city != null)
        ProfileRowData(Icons.location_city_rounded, 'City', a.city!),
      if (a.state != null)
        ProfileRowData(Icons.map_outlined, 'State', a.state!),
      if (a.country != null)
        ProfileRowData(Icons.public_rounded, 'Country', a.country!),
      if (a.postalCode != null)
        ProfileRowData(
          Icons.markunread_mailbox_outlined,
          'Postal code',
          a.postalCode!,
        ),
    ];
    final e = profile.emergencyContact;
    final emergency = <ProfileRowData>[
      if (e.name != null)
        ProfileRowData(Icons.person_outline_rounded, 'Name', e.name!),
      if (e.phone != null)
        ProfileRowData(Icons.call_outlined, 'Phone', e.phone!),
      if (e.relation != null)
        ProfileRowData(Icons.family_restroom_rounded, 'Relation', e.relation!),
    ];
    final fitness = <ProfileRowData>[
      if (profile.goal != null)
        ProfileRowData(
          Icons.flag_outlined,
          'Goal',
          optionLabel(goalOptions, profile.goal!),
        ),
      if (profile.bodyType != null)
        ProfileRowData(
          Icons.accessibility_new_rounded,
          'Body type',
          optionLabel(bodyTypeOptions, profile.bodyType!),
        ),
      if (profile.foodPreference != null)
        ProfileRowData(
          Icons.restaurant_outlined,
          'Food preference',
          optionLabel(foodPreferenceOptions, profile.foodPreference!),
        ),
      if (profile.bloodGroup != null)
        ProfileRowData(
          Icons.bloodtype_outlined,
          'Blood group',
          optionLabel(bloodGroupOptions, profile.bloodGroup!),
        ),
      if (profile.height != null)
        ProfileRowData(
          Icons.height_rounded,
          'Height',
          '${formatMeasure(profile.height)} cm',
        ),
      if (profile.weight != null)
        ProfileRowData(
          Icons.monitor_weight_outlined,
          'Weight',
          '${formatMeasure(profile.weight)} kg',
        ),
      if (profile.occupation != null)
        ProfileRowData(
          Icons.work_outline_rounded,
          'Occupation',
          profile.occupation!,
        ),
      if (profile.fitnessGoals != null)
        ProfileRowData(
          Icons.notes_rounded,
          'Fitness goals',
          profile.fitnessGoals!,
        ),
    ];

    final phoneFormatters = [
      FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s-]')),
    ];
    final decimal = [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))];

    var i = 0;
    Widget block({
      required String id,
      required String title,
      required IconData icon,
      required List<Color> colors,
      required List<String> keys,
      required List<ProfileRowData> rows,
      required List<Widget> Function(ProfileBlockForm f) form,
      String? empty,
    }) =>
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: ProfileBlock(
            key: _blockKeys[id],
            title: title,
            icon: icon,
            colors: colors,
            keys: keys,
            profile: profile,
            rows: rows,
            buildForm: form,
            onSaved: _blockSaved,
            emptyText: empty ?? 'Nothing added yet — tap Edit to add it.',
            index: 3 + i++,
          ),
        );

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.only(bottom: 32),
      children: [
        _ProfileHero(
          top: top,
          name: profile.name,
          subtitle: [
            profile.memberId,
            if (locked.branchName != null) locked.branchName!,
          ].join(' · '),
          photoUrl: photoUrl,
          uploading: _uploading,
          progress: _progress,
          chips: [
            if (locked.status.isNotEmpty) locked.status,
            if (locked.planName != null) locked.planName!,
          ],
          onBack: () => Navigator.of(context).maybePop(),
          onCameraTap: _onCameraTap,
          onEdit: _edit,
          onQr: qr == null || qr.isEmpty ? null : () => _showQr(qr),
        ),
        TeamCenter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                BounceIn(
                  child: _Completeness(
                    pct: pct,
                    checks: checks,
                    hint: hint,
                    onChip: _openCheck,
                  ),
                ),
                const SizedBox(height: 14),
                LayoutBuilder(
                  builder: (context, c) {
                    const gap = 10.0;
                    final cols = c.maxWidth >= 600 ? 3 : 2;
                    final w = (c.maxWidth - gap * (cols - 1)) / cols;
                    final tiles = [
                      ProfileColorTile(
                        index: 1,
                        label: 'Plan',
                        value: locked.planName ?? 'None',
                        hint: locked.membershipEndDate == null
                            ? 'No active plan'
                            : 'Ends ${formatProfileDate(locked.membershipEndDate!)}',
                        icon: Icons.card_membership_rounded,
                        colors: const [Color(0xFF7C3AED), Color(0xFFC026D3)],
                      ),
                      ProfileColorTile(
                        index: 2,
                        label: 'Member since',
                        value: locked.joiningDate == null
                            ? '—'
                            : formatProfileDate(locked.joiningDate!),
                        hint: locked.status.isEmpty ? 'Member' : locked.status,
                        icon: Icons.verified_user_outlined,
                        colors: const [Color(0xFF0D9488), Color(0xFF22D3EE)],
                      ),
                      ProfileColorTile(
                        index: 3,
                        label: 'Trainer',
                        value: locked.trainerName ?? '—',
                        hint: locked.trainerName == null
                            ? 'Not assigned'
                            : 'Your coach',
                        icon: Icons.sports_gymnastics_rounded,
                        colors: const [Color(0xFFF97316), Color(0xFFFBBF24)],
                      ),
                    ];
                    return Wrap(
                      spacing: gap,
                      runSpacing: gap,
                      children: [
                        for (var t = 0; t < tiles.length; t++)
                          SizedBox(
                            width: cols == 2 && t == 2 ? c.maxWidth : w,
                            height: 104,
                            child: tiles[t],
                          ),
                      ],
                    );
                  },
                ),
                if (locked.planName != null) ...[
                  const SizedBox(height: 14),
                  MemberPlanBenefitsSection(reloadToken: _planEpoch),
                ],
                const SizedBox(height: 18),
                block(
                  id: 'personal',
                  title: 'Personal',
                  icon: Icons.person_rounded,
                  colors: const [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                  keys: const [
                    'firstName',
                    'lastName',
                    'dateOfBirth',
                    'gender',
                    'maritalStatus',
                    'anniversary',
                  ],
                  rows: personal,
                  form: (f) => [
                    f.text(
                      'firstName',
                      'First name',
                      caps: TextCapitalization.words,
                    ),
                    f.text(
                      'lastName',
                      'Last name',
                      caps: TextCapitalization.words,
                    ),
                    f.date('dateOfBirth', 'Date of birth'),
                    f.select('gender', 'Gender', genderOptions),
                    f.select('maritalStatus', 'Marital status', maritalOptions),
                    f.date('anniversary', 'Anniversary', future: true),
                  ],
                ),
                block(
                  id: 'contact',
                  title: 'Contact',
                  icon: Icons.call_rounded,
                  colors: const [Color(0xFF0D9488), Color(0xFF22D3EE)],
                  keys: const ['phone', 'email'],
                  rows: contact,
                  form: (f) => [
                    f.text(
                      'phone',
                      'Phone',
                      keyboardType: TextInputType.phone,
                      formatters: phoneFormatters,
                    ),
                    f.text(
                      'email',
                      'Email',
                      keyboardType: TextInputType.emailAddress,
                    ),
                  ],
                ),
                block(
                  id: 'address',
                  title: 'Address',
                  icon: Icons.home_rounded,
                  colors: const [Color(0xFFF59E0B), Color(0xFFF97316)],
                  keys: const [
                    'addressLine',
                    'city',
                    'state',
                    'country',
                    'postalCode',
                  ],
                  rows: addressRows,
                  form: (f) => [
                    f.text(
                      'addressLine',
                      'Address line',
                      caps: TextCapitalization.words,
                    ),
                    f.text('city', 'City', caps: TextCapitalization.words),
                    f.text('state', 'State', caps: TextCapitalization.words),
                    f.text(
                      'country',
                      'Country',
                      caps: TextCapitalization.words,
                    ),
                    f.text('postalCode', 'Postal code'),
                  ],
                ),
                block(
                  id: 'emergency',
                  title: 'Emergency contact',
                  icon: Icons.emergency_rounded,
                  colors: const [Color(0xFFE11D48), Color(0xFFFB7185)],
                  keys: const [
                    'emergencyContactName',
                    'emergencyContactPhone',
                    'emergencyContactRelation',
                  ],
                  rows: emergency,
                  form: (f) => [
                    f.text(
                      'emergencyContactName',
                      'Name',
                      caps: TextCapitalization.words,
                    ),
                    f.text(
                      'emergencyContactPhone',
                      'Phone',
                      keyboardType: TextInputType.phone,
                      formatters: phoneFormatters,
                    ),
                    f.text(
                      'emergencyContactRelation',
                      'Relation',
                      caps: TextCapitalization.words,
                      hint: 'e.g. Spouse',
                    ),
                  ],
                ),
                block(
                  id: 'fitness',
                  title: 'Fitness profile',
                  icon: Icons.fitness_center_rounded,
                  colors: const [Color(0xFF10B981), Color(0xFF84CC16)],
                  keys: const [
                    'goal',
                    'bodyType',
                    'foodPreference',
                    'fitnessGoals',
                    'occupation',
                    'bloodGroup',
                    'height',
                    'weight',
                  ],
                  rows: fitness,
                  form: (f) => [
                    f.select('goal', 'Goal', goalOptions),
                    f.select('bodyType', 'Body type', bodyTypeOptions),
                    f.select(
                      'foodPreference',
                      'Food preference',
                      foodPreferenceOptions,
                    ),
                    f.text(
                      'fitnessGoals',
                      'Fitness goals',
                      caps: TextCapitalization.sentences,
                      minLines: 3,
                      maxLines: 6,
                      hint: 'e.g. Run a 10K by March',
                    ),
                    f.text(
                      'occupation',
                      'Occupation',
                      caps: TextCapitalization.words,
                    ),
                    f.select('bloodGroup', 'Blood group', bloodGroupOptions),
                    f.text(
                      'height',
                      'Height (cm)',
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      formatters: decimal,
                    ),
                    f.text(
                      'weight',
                      'Weight (kg)',
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      formatters: decimal,
                    ),
                  ],
                ),
                BounceIn(
                  index: 8,
                  child: _ManagedBlock(profile: profile),
                ),
                const SizedBox(height: 14),
                BounceIn(
                  index: 9,
                  child: _SecurityCard(
                    appName: appName,
                    onPassword: () =>
                        context.push(AppRoutes.memberChangePassword),
                    onData: () => context.push(AppRoutes.memberDataExport),
                  ),
                ),
                const SizedBox(height: 16),
                BounceIn(
                  index: 10,
                  child: AppButton(
                    label: 'Log out',
                    role: AppRole.member,
                    variant: AppButtonVariant.ghost,
                    foregroundColor: AppColors.danger,
                    onPressed: () => showMemberLogoutDialog(context),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// "Managed by your gym" — read-only facts in slate with a lock note.
class _ManagedBlock extends StatelessWidget {
  const _ManagedBlock({required this.profile});

  final MemberSelfProfile profile;

  @override
  Widget build(BuildContext context) {
    final l = profile.locked;
    return MemberSection(
      title: 'Managed by your gym',
      icon: Icons.lock_outline_rounded,
      color: TeamColors.slate,
      flush: true,
      child: Column(
        children: [
          MemberListRow(
            icon: Icons.badge_outlined,
            color: TeamColors.slate,
            title: profile.memberId,
            subtitle: 'Member ID',
          ),
          if (l.status.isNotEmpty)
            MemberListRow(
              icon: Icons.verified_outlined,
              color: TeamColors.slate,
              title: l.status,
              subtitle: 'Status',
            ),
          if (l.branchName != null)
            MemberListRow(
              icon: Icons.storefront_outlined,
              color: TeamColors.slate,
              title: l.branchName!,
              subtitle: 'Branch',
            ),
          if (l.trainerName != null)
            MemberListRow(
              icon: Icons.person_outline_rounded,
              color: TeamColors.slate,
              title: l.trainerName!,
              subtitle: 'Trainer',
            ),
          if (l.planName != null)
            MemberListRow(
              icon: Icons.card_membership_rounded,
              color: TeamColors.slate,
              title: l.planName!,
              subtitle: l.membershipEndDate == null
                  ? 'Plan'
                  : 'Plan · ends ${formatProfileDate(l.membershipEndDate!)}',
            ),
          if (l.joiningDate != null)
            MemberListRow(
              icon: Icons.event_available_outlined,
              color: TeamColors.slate,
              title: formatProfileDate(l.joiningDate!),
              subtitle: 'Joined',
            ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Icon(
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
          ),
        ],
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────── hero

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({
    required this.top,
    required this.name,
    required this.subtitle,
    required this.photoUrl,
    required this.uploading,
    required this.progress,
    required this.chips,
    required this.onBack,
    required this.onCameraTap,
    required this.onEdit,
    required this.onQr,
  });

  final double top;
  final String name;
  final String subtitle;
  final String? photoUrl;
  final bool uploading;
  final double? progress;
  final List<String> chips;
  final VoidCallback onBack;
  final VoidCallback onCameraTap;
  final VoidCallback onEdit;
  final VoidCallback? onQr;

  @override
  Widget build(BuildContext context) {
    return Looping(
      duration: const Duration(seconds: 9),
      reverse: true,
      builder: (context, t) => Container(
        decoration: BoxDecoration(
          borderRadius:
              const BorderRadius.vertical(bottom: Radius.circular(34)),
          gradient: LinearGradient(
            begin: Alignment(-1 + t * 0.5, -1),
            end: Alignment(1 - t * 0.5, 1),
            colors: const [
              Color(0xFF053B34),
              Color(0xFF0A6E5E),
              Color(0xFF0FA58A),
            ],
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            Positioned(
              right: -50 + 24 * t,
              top: -50,
              child: _blob(210, AppColors.memberA.withValues(alpha: 0.38)),
            ),
            Positioned(
              left: -60 - 16 * t,
              bottom: -30 + 14 * t,
              child: _blob(190, const Color(0x6622D3EE)),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(18, top + 8, 18, 22),
              child: Column(
                children: [
                  Row(
                    children: [
                      GestureDetector(
                        onTap: onBack,
                        child: Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.18),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.arrow_back_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        'MY PROFILE',
                        style: AppText.eyebrow(
                          color: Colors.white.withValues(alpha: 0.8),
                        ),
                      ),
                      const Spacer(),
                      const SizedBox(width: 38),
                    ],
                  ),
                  const SizedBox(height: 14),
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0.6, end: 1),
                    duration: const Duration(milliseconds: 650),
                    curve: Curves.elasticOut,
                    builder: (context, v, child) =>
                        Transform.scale(scale: v, child: child),
                    child: _Avatar(
                      photoUrl: photoUrl,
                      name: name,
                      uploading: uploading,
                      progress: progress,
                      onCameraTap: onCameraTap,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    name,
                    textAlign: TextAlign.center,
                    style: AppText.display(size: 26, color: Colors.white),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    textAlign: TextAlign.center,
                    style: AppText.body(
                      size: 12.5,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                  if (chips.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      alignment: WrapAlignment.center,
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final c in chips)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(99),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.28),
                              ),
                            ),
                            child: Text(
                              c,
                              style: AppText.body(
                                size: 11,
                                weight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: MemberHeroButton(
                          icon: Icons.edit_outlined,
                          label: 'Edit profile',
                          solid: true,
                          onTap: onEdit,
                        ),
                      ),
                      if (onQr != null) ...[
                        const SizedBox(width: 8),
                        Expanded(
                          child: MemberHeroButton(
                            icon: Icons.qr_code_2_rounded,
                            label: 'Check-in QR',
                            onTap: onQr!,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _blob(double size, Color color) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: [color, color.withValues(alpha: 0)]),
        ),
      );
}

/// Avatar in a slowly rotating lime → teal ring with the camera badge.
class _Avatar extends StatelessWidget {
  const _Avatar({
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

  static const _size = 112.0;

  @override
  Widget build(BuildContext context) {
    final duration = reduceMotion(context)
        ? Duration.zero
        : const Duration(milliseconds: 250);
    return SizedBox(
      width: _size + 14,
      height: _size + 14,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            left: 0,
            top: 0,
            child: Looping(
              duration: const Duration(seconds: 6),
              builder: (context, t) => Container(
                width: _size + 8,
                height: _size + 8,
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: SweepGradient(
                    transform: GradientRotation(t * math.pi * 2),
                    colors: [
                      AppColors.memberA,
                      AppColors.memberB,
                      Colors.white,
                      AppColors.memberB,
                      AppColors.memberA,
                    ],
                  ),
                ),
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: const BoxDecoration(
                    color: Color(0xFF0A4F46),
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
                        size: _size - 8,
                        role: AppRole.member,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (uploading)
            Positioned.fill(
              child: Padding(
                padding: const EdgeInsets.only(right: 14, bottom: 14),
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
          // 56dp tap area, visually a 38dp badge in the avatar's corner.
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
                  radius: 30,
                  child: SizedBox(
                    width: 56,
                    height: 56,
                    child: Center(
                      child: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          gradient: AppColors.memberGrad,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x55000000),
                              blurRadius: 8,
                              offset: Offset(0, 3),
                            ),
                          ],
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

// ───────────────────────────────────────────────────────── completeness

class _Completeness extends StatelessWidget {
  const _Completeness({
    required this.pct,
    required this.checks,
    required this.hint,
    required this.onChip,
  });

  final int pct;
  final List<ProfileCheck> checks;
  final String? hint;
  final ValueChanged<String> onChip;

  @override
  Widget build(BuildContext context) {
    final complete = pct == 100;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: complete
              ? const [Color(0xFF059669), Color(0xFF34D399)]
              : const [Color(0xFF4338CA), Color(0xFFC026D3)],
        ),
        boxShadow: [
          BoxShadow(
            color:
                (complete ? const Color(0xFF059669) : const Color(0xFF7C3AED))
                    .withValues(alpha: 0.4),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AnimatedFraction(
                fraction: pct / 100,
                builder: (_, v) => SizedBox(
                  width: 78,
                  height: 78,
                  child: CustomPaint(
                    painter: _WhiteRing(v),
                    child: Center(
                      child: AnimatedNumber(
                        value: pct.toDouble(),
                        format: (n) => '${n.round()}%',
                        style: AppText.display(size: 17, color: Colors.white),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      complete ? 'Profile complete' : 'Profile completeness',
                      style: AppText.display(size: 16, color: Colors.white),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      hint ?? 'Nice work — everything is filled in!',
                      style: AppText.body(
                        size: 12,
                        weight: FontWeight.w600,
                        color: Colors.white.withValues(alpha: 0.9),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (var i = 0; i < checks.length; i++)
                _CheckChip(check: checks[i], index: i, onTap: onChip),
            ],
          ),
        ],
      ),
    );
  }
}

class _WhiteRing extends CustomPainter {
  _WhiteRing(this.fraction);

  final double fraction;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 8.0;
    final arc = (Offset.zero & size).deflate(stroke / 2);
    canvas.drawArc(
      arc,
      0,
      math.pi * 2,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = Colors.white.withValues(alpha: 0.28),
    );
    if (fraction <= 0) return;
    canvas.drawArc(
      arc,
      -math.pi / 2,
      math.pi * 2 * fraction.clamp(0, 1),
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..color = Colors.white,
    );
  }

  @override
  bool shouldRepaint(covariant _WhiteRing old) => old.fraction != fraction;
}

class _CheckChip extends StatelessWidget {
  const _CheckChip({
    required this.check,
    required this.index,
    required this.onTap,
  });

  final ProfileCheck check;
  final int index;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    final done = check.done;
    final chip = PressBounce(
      onTap: done ? null : () => onTap(check.label),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: done
              ? Colors.white.withValues(alpha: 0.95)
              : Colors.white.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: Colors.white.withValues(alpha: 0.5)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              done ? Icons.check_circle_rounded : Icons.add_circle_outline,
              size: 14,
              color: done ? const Color(0xFF059669) : Colors.white,
            ),
            const SizedBox(width: 4),
            Text(
              check.label,
              style: AppText.body(
                size: 11,
                weight: FontWeight.w800,
                color: done ? const Color(0xFF065F46) : Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
    if (reduceMotion(context)) return chip;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 500 + index * 60),
      curve: Curves.elasticOut,
      builder: (_, v, child) => Opacity(
        opacity: v.clamp(0.0, 1.0),
        child: Transform.scale(scale: 0.6 + 0.4 * v, child: child),
      ),
      child: chip,
    );
  }
}

// ──────────────────────────────────────────────────────────── security

/// Security + data: the password screen and the data export, tucked behind a
/// tap that expands in place (web collapses its password form the same way).
class _SecurityCard extends StatefulWidget {
  const _SecurityCard({
    required this.appName,
    required this.onPassword,
    required this.onData,
  });

  final String appName;
  final VoidCallback onPassword;
  final VoidCallback onData;

  @override
  State<_SecurityCard> createState() => _SecurityCardState();
}

class _SecurityCardState extends State<_SecurityCard> {
  bool _open = true;

  @override
  Widget build(BuildContext context) {
    return MemberSection(
      title: 'Security & data',
      subtitle: 'Password and your information',
      icon: Icons.shield_outlined,
      color: TeamColors.amber,
      child: AnimatedSize(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
        alignment: Alignment.topCenter,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            GestureDetector(
              onTap: () => setState(() => _open = !_open),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      _open ? 'Hide options' : 'Show options',
                      style: AppText.body(
                        size: 12.5,
                        weight: FontWeight.w800,
                        color: AppColors.memberPillFg,
                      ),
                    ),
                  ),
                  AnimatedRotation(
                    turns: _open ? 0.5 : 0,
                    duration: const Duration(milliseconds: 220),
                    child: Icon(
                      Icons.keyboard_arrow_down_rounded,
                      color: AppColors.memberPillFg,
                    ),
                  ),
                ],
              ),
            ),
            if (_open) ...[
              const SizedBox(height: 10),
              Text(
                'Change the password you use to sign in.',
                style: AppText.body(
                  size: 13,
                  weight: FontWeight.w600,
                  color: AppColors.inkSoft,
                ),
              ),
              const SizedBox(height: 8),
              AppButton(
                label: 'Change password',
                role: AppRole.member,
                variant: AppButtonVariant.ghost,
                size: AppButtonSize.small,
                onPressed: widget.onPassword,
              ),
              const SizedBox(height: 12),
              Text(
                'See everything ${widget.appName} stores about you.',
                style: AppText.body(
                  size: 13,
                  weight: FontWeight.w600,
                  color: AppColors.inkSoft,
                ),
              ),
              const SizedBox(height: 8),
              AppButton(
                label: 'Download my data',
                role: AppRole.member,
                variant: AppButtonVariant.ghost,
                size: AppButtonSize.small,
                onPressed: widget.onData,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
