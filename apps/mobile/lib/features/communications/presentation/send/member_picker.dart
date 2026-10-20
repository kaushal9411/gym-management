import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/common/paginated_list_cubit.dart';
import '../../../../bloc/common/paginated_list_state.dart';
import '../../../../bloc/communications/send_flow_cubit.dart';
import '../../../../bloc/communications/send_flow_state.dart';
import '../../../../core/di/service_locator.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/comm_audience.dart';
import '../../../../models/comm_channel.dart';
import '../../../../repositories/communications_repository.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../comm_constants.dart';
import '../../comm_logic.dart' show CommTone;
import '../widgets/comm_widgets.dart';
import 'send_ui.dart';

/// "Pick members" half of the Audience step (design frame 2): debounced
/// search, **Select shown** / **Clear**, the picked members as removable
/// chips, and the paginated result list (`GET /communications/audience/members`
/// through a [PaginatedListCubit], 20 per page + Load more).
///
/// The API's picker is used on purpose (not `GET /members`): it needs only
/// `notifications:send`, applies the staff user's branch scope and lists only
/// messageable (active / frozen) members.
class MemberPicker extends StatefulWidget {
  const MemberPicker({super.key});

  @override
  State<MemberPicker> createState() => _MemberPickerState();
}

class _MemberPickerState extends State<MemberPicker> {
  final _search = TextEditingController();
  Timer? _debounce;
  String _query = '';
  late final PaginatedListCubit<PickerMember> _list;

  @override
  void initState() {
    super.initState();
    _list = PaginatedListCubit<PickerMember>(
      (page) => getIt<CommunicationsRepository>().pickerMembers(
        search: _query,
        page: page,
      ),
    )..load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    _list.close();
    super.dispose();
  }

  void _onChanged(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      final q = v.trim();
      if (q == _query) return;
      _query = q;
      _list.load();
    });
    setState(() {});
  }

  void _clearSearch() {
    _search.clear();
    _debounce?.cancel();
    if (_query.isNotEmpty) {
      _query = '';
      _list.load();
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final flow = context.read<SendFlowCubit>();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _search,
          onChanged: _onChanged,
          textInputAction: TextInputAction.search,
          style: AppText.body(size: 14, weight: FontWeight.w600),
          decoration: commFieldDecoration(
            hint: 'Search name, member ID or phone',
            prefix: Icon(
              Icons.search_rounded,
              size: 19,
              color: AppColors.inkFaint,
            ),
          ).copyWith(
            suffixIcon: _search.text.isEmpty
                ? null
                : IconButton(
                    tooltip: 'Clear search',
                    icon: Icon(
                      Icons.close_rounded,
                      size: 18,
                      color: AppColors.inkFaint,
                    ),
                    onPressed: _clearSearch,
                  ),
          ),
        ),
        const SizedBox(height: 8),
        BlocBuilder<PaginatedListCubit<PickerMember>,
            PaginatedListState<PickerMember>>(
          bloc: _list,
          builder: (context, listState) {
            final shown = listState is PaginatedListLoaded<PickerMember>
                ? listState.items
                : const <PickerMember>[];
            return Row(
              children: [
                Expanded(
                  child: CommChip(
                    label: 'Select shown',
                    selected: false,
                    icon: Icons.done_all_rounded,
                    onTap: shown.isEmpty ? null : () => flow.pickMany(shown),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: BlocBuilder<SendFlowCubit, SendFlowState>(
                    builder: (context, s) => CommChip(
                      label: 'Clear',
                      selected: false,
                      icon: Icons.close_rounded,
                      onTap: s.picked.isEmpty ? null : flow.clearPicked,
                    ),
                  ),
                ),
              ],
            );
          },
        ),
        BlocBuilder<SendFlowCubit, SendFlowState>(
          buildWhen: (a, b) => a.picked.length != b.picked.length,
          builder: (context, s) => _PickedChips(
            picked: s.picked.values.toList(),
            onRemove: flow.removePicked,
          ),
        ),
        const SizedBox(height: 4),
        BlocBuilder<PaginatedListCubit<PickerMember>,
            PaginatedListState<PickerMember>>(
          bloc: _list,
          builder: (context, listState) => switch (listState) {
            PaginatedListLoading() =>
              const CommSkeletonList(rows: 4, rowHeight: 52),
            PaginatedListError(:final message) => CommNotice(
                text: message,
                tone: CommTone.bad,
                icon: Icons.error_outline_rounded,
                actionLabel: 'Retry',
                onAction: _list.load,
              ),
            PaginatedListLoaded(:final items) when items.isEmpty => Padding(
                padding: const EdgeInsets.symmetric(vertical: 18),
                child: Center(
                  child: Text(
                    _query.isEmpty
                        ? 'No members can be messaged yet.'
                        : 'No member found.',
                    style: AppText.body(
                      size: 13,
                      weight: FontWeight.w600,
                      color: AppColors.inkFaint,
                    ),
                  ),
                ),
              ),
            PaginatedListLoaded(
              :final items,
              :final hasMore,
              :final loadingMore,
            ) =>
              BlocBuilder<SendFlowCubit, SendFlowState>(
                buildWhen: (a, b) => a.picked.length != b.picked.length,
                builder: (context, s) => Column(
                  children: [
                    for (final m in items)
                      _PickRow(
                        member: m,
                        picked: s.picked.containsKey(m.id),
                        onTap: () => flow.togglePick(m),
                      ),
                    if (hasMore)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: AppButton(
                          label: 'Load more',
                          variant: AppButtonVariant.ghost,
                          size: AppButtonSize.small,
                          fullWidth: false,
                          loading: loadingMore,
                          onPressed: _list.loadMore,
                        ),
                      ),
                  ],
                ),
              ),
          },
        ),
      ],
    );
  }
}

class _PickedChips extends StatelessWidget {
  const _PickedChips({required this.picked, required this.onRemove});

  final List<PickerMember> picked;
  final ValueChanged<String> onRemove;

  static const _cap = 30;

  @override
  Widget build(BuildContext context) {
    if (picked.isEmpty) return const SizedBox.shrink();
    final shown = picked.reversed.take(_cap).toList();
    final hidden = picked.length - shown.length;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: SizedBox(
        height: 40,
        child: ListView(
          scrollDirection: Axis.horizontal,
          children: [
            for (final m in shown)
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: Semantics(
                  label: 'Picked ${m.name}. Double tap to remove.',
                  button: true,
                  child: CommPress(
                    onTap: () => onRemove(m.id),
                    child: Container(
                      padding: const EdgeInsets.only(left: 11, right: 6),
                      decoration: BoxDecoration(
                        color: kCommBrand.withValues(alpha: 0.16),
                        borderRadius: BorderRadius.circular(99),
                        border: Border.all(color: kCommBrand),
                      ),
                      child: Row(
                        children: [
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 140),
                            child: Text(
                              m.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.body(
                                size: 12.5,
                                weight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const SizedBox(width: 4),
                          Icon(
                            Icons.close_rounded,
                            size: 16,
                            color: AppColors.inkSoft,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            if (hidden > 0)
              Center(
                child: Text(
                  '+$hidden more',
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w700,
                    color: AppColors.inkFaint,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _PickRow extends StatelessWidget {
  const _PickRow({
    required this.member,
    required this.picked,
    required this.onTap,
  });

  final PickerMember member;
  final bool picked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final m = member;
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: CommPress(
        onTap: onTap,
        selected: picked,
        scale: 0.98,
        semanticLabel: '${m.name}, ${m.subtitle}',
        child: AnimatedContainer(
          duration: reduce ? Duration.zero : const Duration(milliseconds: 150),
          constraints: const BoxConstraints(minHeight: 52),
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
          decoration: BoxDecoration(
            color: picked
                ? kCommBrand.withValues(alpha: 0.14)
                : AppColors.surface2,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: picked ? kCommBrand : AppColors.line,
              width: 1.5,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(colors: [kCommBrand, kCommWarm]),
                ),
                child: Text(
                  m.initials,
                  style: AppText.body(
                    size: 13,
                    weight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      m.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 13.5, weight: FontWeight.w800),
                    ),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            m.subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w600,
                              color: AppColors.inkFaint,
                            ),
                          ),
                        ),
                        if (m.hasDevice) _mini(CommChannel.push),
                        if (m.hasEmail) _mini(CommChannel.email),
                        if (m.hasPhone) _mini(CommChannel.sms),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              AnimatedContainer(
                duration:
                    reduce ? Duration.zero : const Duration(milliseconds: 200),
                curve: Curves.easeOutBack,
                width: 22,
                height: 22,
                transform: Matrix4.diagonal3Values(
                  picked ? 1.1 : 1.0,
                  picked ? 1.1 : 1.0,
                  1,
                ),
                transformAlignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: picked ? kCommBrand : Colors.transparent,
                  border: Border.all(
                    color: picked ? kCommBrand : AppColors.line,
                    width: 2,
                  ),
                ),
                child: picked
                    ? const Icon(
                        Icons.check_rounded,
                        size: 14,
                        color: Colors.white,
                      )
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _mini(CommChannel c) => Padding(
        padding: const EdgeInsets.only(left: 3),
        child: Icon(c.icon, size: 12, color: c.color),
      );
}
