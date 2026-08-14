import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/global_search_result.dart';
import '../../../repositories/search_repository.dart';
import '../../../shared/widgets/app_state_views.dart';

const _sectionLabels = {
  SearchCategory.member: 'Members',
  SearchCategory.staff: 'Staff',
  SearchCategory.branch: 'Branches',
};

/// `GET /search` — no frame in the design (the Kinetic mockup has no
/// search UI on any staff screen); reached from a Menu tile, matching how
/// Payments/Billing address were added. Deliberately scoped to Members/
/// Staff/Branches server-side — everything else already has its own
/// in-page search. Each category is included only if the caller can view
/// it, so an empty section can mean either "no matches" or "you don't have
/// that permission" — both render the same empty state, matching what the
/// backend actually tells you (nothing more specific to show).
class GlobalSearchScreen extends StatefulWidget {
  const GlobalSearchScreen({super.key});

  @override
  State<GlobalSearchScreen> createState() => _GlobalSearchScreenState();
}

class _GlobalSearchScreenState extends State<GlobalSearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  GlobalSearchResult? _result;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    final query = value.trim();
    if (query.length < 2) {
      setState(() {
        _result = null;
        _loading = false;
        _error = null;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () => _search(query));
  }

  Future<void> _search(String query) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await getIt<SearchRepository>().search(query);
      if (!mounted) return;
      setState(() => _result = result);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openResult(SearchResultItem item) {
    final route = switch (item.category) {
      SearchCategory.member => AppRoutes.memberDetail,
      SearchCategory.staff => AppRoutes.staffDetail,
      SearchCategory.branch => AppRoutes.branchDetail,
    };
    context.push(route, extra: item.id);
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: const Text('Search'),
      ),
      body: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: _controller,
                autofocus: true,
                onChanged: _onChanged,
                style: AppText.body(size: 15, weight: FontWeight.w600),
                decoration: InputDecoration(
                  hintText: 'Search members, staff, branches…',
                  hintStyle: AppText.body(size: 14, color: AppColors.inkFaint),
                  filled: true,
                  fillColor: AppColors.surface2,
                  prefixIcon: const Icon(
                    Icons.search_rounded,
                    color: AppColors.inkFaint,
                  ),
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadii.field),
                    borderSide: const BorderSide(color: AppColors.line),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadii.field),
                    borderSide: const BorderSide(color: AppColors.line),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Expanded(child: _buildBody(result)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody(GlobalSearchResult? result) {
    if (_controller.text.trim().length < 2) {
      return const AppEmptyState(
        icon: Icons.search_rounded,
        title: 'Search FitCloud',
        message: 'Type at least 2 characters to search members, staff and '
            'branches.',
      );
    }
    if (_loading) return const AppLoadingView();
    if (_error != null) {
      return AppErrorView(
        message: _error!,
        onRetry: () => _search(_controller.text.trim()),
      );
    }
    if (result == null) return const SizedBox.shrink();
    if (result.isEmpty) {
      return const AppEmptyState(
        icon: Icons.search_off_rounded,
        title: 'No matches',
      );
    }

    return ListView(
      children: [
        for (final section in [result.members, result.staff, result.branches])
          if (section.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: 8, top: 6),
              child: Text(
                _sectionLabels[section.first.category]!,
                style: AppText.eyebrow(),
              ),
            ),
            for (final item in section) _ResultTile(
                  item: item,
                  onTap: () => _openResult(item),
                ),
          ],
      ],
    );
  }
}

class _ResultTile extends StatelessWidget {
  const _ResultTile({required this.item, required this.onTap});

  final SearchResultItem item;
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
              border: Border.all(color: AppColors.line),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        style: AppText.body(size: 14, weight: FontWeight.w700),
                      ),
                      Text(
                        item.subtitle,
                        style: AppText.body(
                          size: 11,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
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
