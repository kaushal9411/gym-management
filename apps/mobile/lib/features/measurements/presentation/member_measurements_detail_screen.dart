import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/body_measurement.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/body_measurement_repository.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'measurement_charts.dart';
import 'measurement_form.dart';
import 'measurement_ui.dart';

/// A focused view of just one member's measurement history — reached from
/// `MeasuredMembersScreen`, the Record-a-measurement page, and the hero
/// facepile sheets. Deliberately NOT the full Member Detail screen
/// (`features/manager/presentation/member_detail_screen.dart`); it mirrors
/// web's `/measurements/[memberId]` page: member hero (avatar, ID · branch,
/// latest weight / body fat, entry count, trainer), the weight + body-fat
/// trend, and the entries card — latest entry with Edit / Delete, Record
/// measurement (inline form), and a collapsible History of older entries.
///
/// **Gating** (matches web's `MemberMeasurementsCard`): Record ->
/// `measurements:create`, Edit -> `measurements:update`, Delete ->
/// `measurements:delete`; the page itself is reached through the
/// `measurements:view` Menu tile. Deleting asks for confirmation first.
///
/// **API traps**: DECIMAL values arrive as strings (parsed in the model);
/// PATCH cannot clear a value, so blanking a field while editing leaves the
/// old value (same as web).
class MemberMeasurementsDetailScreen extends StatefulWidget {
  const MemberMeasurementsDetailScreen({super.key, required this.memberId});

  final String memberId;

  @override
  State<MemberMeasurementsDetailScreen> createState() =>
      _MemberMeasurementsDetailScreenState();
}

class _MemberMeasurementsDetailScreenState
    extends State<MemberMeasurementsDetailScreen> {
  GymMember? _member;
  List<BodyMeasurement>? _entries;
  bool _loading = true;
  String? _error;

  bool _recording = false;
  String? _editingId;
  String? _deletingId;
  bool _historyOpen = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final results = await Future.wait([
        getIt<MemberRepository>().getById(widget.memberId),
        getIt<BodyMeasurementRepository>().listForMember(widget.memberId),
      ]);
      if (!mounted) return;
      setState(() {
        _member = results[0] as GymMember;
        _entries = results[1] as List<BodyMeasurement>;
        _loading = false;
        _error = null;
      });
    } on ApiException catch (e) {
      _fail(e.message);
    } catch (e) {
      _fail("Couldn't load this member's measurements.");
    }
  }

  void _fail(String message) {
    if (!mounted) return;
    if (_entries != null) {
      setState(() => _loading = false);
      teamSnack(context, message, error: true);
    } else {
      setState(() {
        _loading = false;
        _error = message;
      });
    }
  }

  // ── actions ───────────────────────────────────────────────────────────────

  Future<void> _create(BodyMeasurementFormInput input) async {
    await getIt<BodyMeasurementRepository>().create(widget.memberId, input);
    if (!mounted) return;
    setState(() => _recording = false);
    teamSnack(context, 'Measurement recorded.');
    await _load(silent: true);
  }

  Future<void> _update(
    BodyMeasurement entry,
    BodyMeasurementFormInput input,
  ) async {
    await getIt<BodyMeasurementRepository>().update(entry.id, input);
    if (!mounted) return;
    setState(() => _editingId = null);
    teamSnack(context, 'Measurement updated.');
    await _load(silent: true);
  }

  Future<void> _delete(BodyMeasurement entry) async {
    final ok = await confirmTeam(
      context,
      title: 'Delete this measurement?',
      message: 'The ${longDay(entry.recordedAt)} entry will be removed '
          'from ${_member?.name ?? 'this member'}\'s history.',
      confirmLabel: 'Delete',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _deletingId = entry.id);
    try {
      await getIt<BodyMeasurementRepository>().delete(entry.id);
      if (!mounted) return;
      teamSnack(context, 'Measurement deleted.');
      await _load(silent: true);
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) {
        teamSnack(context, 'Could not delete the measurement.', error: true);
      }
    } finally {
      if (mounted) setState(() => _deletingId = null);
    }
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final member = _member;
    final entries = _entries;
    final ready = member != null && entries != null;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: ready,
      appBar: AppBar(
        backgroundColor: ready ? Colors.transparent : AppColors.bg,
        foregroundColor: ready ? Colors.white : null,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: ready ? null : const Text('Measurements'),
      ),
      body: !ready
          ? (_loading
              ? const AppLoadingView()
              : AppErrorView(
                  message: _error ?? 'Something went wrong.',
                  onRetry: _load,
                ))
          : RefreshIndicator(
              color: AppColors.staffB,
              backgroundColor: AppColors.surface2,
              onRefresh: () => _load(silent: true),
              child: _content(member, entries),
            ),
    );
  }

  Widget _content(GymMember member, List<BodyMeasurement> entries) {
    final access = MeasurementAccess.of(context);
    final latest = entries.isEmpty ? null : entries.first;
    final topInset = MediaQuery.of(context).padding.top + kToolbarHeight;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      children: [
        TeamHero(
          topInset: topInset,
          name: member.name,
          subtitle:
              '${member.memberId.isEmpty ? 'No member ID' : member.memberId}'
              ' · ${member.branch.name}',
          avatarUrl: member.profilePhotoUrl,
          pills: [
            if (latest?.weightKg != null)
              TeamHeroPill(
                '${fmtNum(latest!.weightKg!)} kg',
                icon: Icons.monitor_weight_rounded,
              ),
            if (latest?.bodyFatPercent != null)
              TeamHeroPill('${fmtNum(latest!.bodyFatPercent!)}% body fat'),
            TeamHeroPill(
              '${entries.length} ${entries.length == 1 ? 'entry' : 'entries'}',
              icon: Icons.checklist_rounded,
            ),
            if (member.trainer != null)
              TeamHeroPill(member.trainer!.name, icon: Icons.sports_rounded),
          ],
        ),
        TeamCenter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            child: LayoutBuilder(
              builder: (context, c) {
                final trend = TeamSectionCard(
                  icon: Icons.show_chart_rounded,
                  color: TeamColors.teal,
                  title: 'Weight & body fat trend',
                  child: MeasurementTrendBody(entries: entries),
                );
                final list = _entriesCard(entries, access);
                if (c.maxWidth < 900) {
                  return Column(
                    children: [trend, const SizedBox(height: 14), list],
                  );
                }
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: trend),
                    const SizedBox(width: 14),
                    Expanded(child: list),
                  ],
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _entriesCard(List<BodyMeasurement> entries, MeasurementAccess access) {
    final latest = entries.isEmpty ? null : entries.first;
    final history =
        entries.length > 1 ? entries.sublist(1) : const <BodyMeasurement>[];
    return TeamSectionCard(
      icon: Icons.straighten_rounded,
      color: TeamColors.indigo,
      title: 'Body measurements',
      subtitle: entries.isEmpty
          ? null
          : '${entries.length} ${entries.length == 1 ? 'entry' : 'entries'}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (entries.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Text(
                'No measurements recorded yet.',
                style: AppText.body(size: 13, color: AppColors.inkFaint),
              ),
            )
          else
            _entry(latest!, isLatest: true, access: access),
          if (access.canCreate) ...[
            const SizedBox(height: 12),
            if (_recording)
              MeasurementEntryForm(
                key: const ValueKey('record-form'),
                onSubmit: _create,
                onCancel: () => setState(() => _recording = false),
              )
            else
              TeamOutlineButton(
                label: 'Record measurement',
                icon: Icons.add_rounded,
                onTap: () => setState(() => _recording = true),
              ),
          ],
          if (history.isNotEmpty) ...[
            const SizedBox(height: 12),
            InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => setState(() => _historyOpen = !_historyOpen),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'History (${history.length})',
                        style: AppText.body(
                          size: 13,
                          weight: FontWeight.w800,
                          color: AppColors.inkSoft,
                        ),
                      ),
                    ),
                    Icon(
                      _historyOpen
                          ? Icons.expand_less_rounded
                          : Icons.expand_more_rounded,
                      color: AppColors.inkFaint,
                    ),
                  ],
                ),
              ),
            ),
            if (_historyOpen)
              for (final e in history) ...[
                const SizedBox(height: 8),
                _entry(e, isLatest: false, access: access),
              ],
          ],
        ],
      ),
    );
  }

  Widget _entry(
    BodyMeasurement e, {
    required bool isLatest,
    required MeasurementAccess access,
  }) {
    if (_editingId == e.id) {
      return MeasurementEntryForm(
        key: ValueKey('edit-${e.id}'),
        initial: e,
        saveLabel: 'Save',
        onSubmit: (input) => _update(e, input),
        onCancel: () => setState(() => _editingId = null),
      );
    }
    final deleting = _deletingId == e.id;
    final fields = recordedFields(e);
    return Container(
      key: ValueKey('entry-${e.id}'),
      padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
      decoration: BoxDecoration(
        color: isLatest
            ? TeamColors.indigo.withValues(alpha: 0.07)
            : AppColors.surface2,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isLatest
              ? TeamColors.indigo.withValues(alpha: 0.28)
              : AppColors.line,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      longDay(e.recordedAt),
                      style: AppText.body(size: 14, weight: FontWeight.w800),
                    ),
                    if (isLatest)
                      const TeamTag(
                        label: 'Latest',
                        color: TeamColors.green,
                        icon: Icons.bolt_rounded,
                      ),
                    if (e.isMemberLogged)
                      const TeamTag(
                        label: 'Logged by member',
                        color: TeamColors.teal,
                        icon: Icons.person_rounded,
                      ),
                  ],
                ),
              ),
              if (access.canUpdate)
                IconButton(
                  tooltip: 'Edit',
                  visualDensity: VisualDensity.compact,
                  icon: Icon(
                    Icons.edit_outlined,
                    size: 19,
                    color: AppColors.inkSoft,
                  ),
                  onPressed:
                      deleting ? null : () => setState(() => _editingId = e.id),
                ),
              if (access.canDelete)
                deleting
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : IconButton(
                        tooltip: 'Delete',
                        visualDensity: VisualDensity.compact,
                        icon: const Icon(
                          Icons.delete_outline_rounded,
                          size: 19,
                          color: AppColors.danger,
                        ),
                        onPressed:
                            _deletingId != null ? null : () => _delete(e),
                      ),
            ],
          ),
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: fields.isEmpty
                ? Text(
                    'No values recorded',
                    style: AppText.body(size: 12.5, color: AppColors.inkFaint),
                  )
                : Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final f in fields)
                        MeasurementValueChip(field: f, value: f.of(e)!),
                    ],
                  ),
          ),
          if (e.notes != null && e.notes!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Text(
                e.notes!,
                style: AppText.body(size: 12.5, color: AppColors.inkSoft),
              ),
            ),
          ],
          if (e.recordedBy != null) ...[
            const SizedBox(height: 6),
            Text(
              'Recorded by ${e.recordedBy!.name}',
              style: AppText.body(
                size: 11,
                weight: FontWeight.w600,
                color: AppColors.inkFaint,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
