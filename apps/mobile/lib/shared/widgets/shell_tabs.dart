import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/tenant_features.dart';
import '../../core/utils/tenant_features_context.dart';
import '../../models/tenant_branding.dart';
import 'glass_bottom_nav.dart';
import 'slide_drawer_scaffold.dart';

/// One bottom-nav tab of a role shell: the nav item, the screen it shows and
/// the (optional) module flag that keeps it on the nav. A shell declares ONE
/// ordered list of these so the nav items and the `IndexedStack` children can
/// never drift out of alignment when a tab is filtered away.
class ShellTab {
  const ShellTab({
    required this.id,
    required this.item,
    required this.child,
    this.featureFlag,
    this.featureFlagsAny = const [],
  });

  /// Stable key ('home', 'finance', ...): the selection is remembered by id,
  /// not by position, so a tab disappearing never re-points it at a neighbour.
  final String id;
  final GlassNavItem item;
  final Widget child;

  /// Tab shown only while this module is on.
  final String? featureFlag;

  /// Tab shown only while at least one of these modules is on.
  final List<String> featureFlagsAny;

  bool visibleFor(TenantBranding? tenant) =>
      tenant == null ||
      tenantAllows(tenant, flag: featureFlag, anyOf: featureFlagsAny);
}

/// The tabs [tenant]'s modules allow, in declared order. A null tenant (no
/// session to judge by) keeps everything.
List<ShellTab> visibleShellTabs(List<ShellTab> tabs, TenantBranding? tenant) =>
    tabs.where((t) => t.visibleFor(tenant)).toList();

/// Position of [selectedId] among [visible], falling back to the first tab
/// (Home) when the selected tab was just filtered away.
int shellTabIndex(List<ShellTab> visible, String selectedId) {
  final i = visible.indexWhere((t) => t.id == selectedId);
  return i < 0 ? 0 : i;
}

/// The `IndexedStack` children: ONE slot per tab of [all], in declared order.
/// A tab that is not in [visible] (its module is off) gets an empty
/// placeholder instead of being removed, so the positions of the others never
/// shift. `IndexedStack` wraps its children unkeyed and matches them by
/// position, so removing a slot would hand the next tab's State to its
/// neighbour (the tab-cache trap) — a placeholder keeps every surviving tab's
/// State intact. The hidden tab's screen is not built at all.
List<Widget> shellTabChildren(List<ShellTab> all, List<ShellTab> visible) {
  final shown = {for (final t in visible) t.id};
  return [
    for (final t in all)
      if (shown.contains(t.id))
        KeyedSubtree(key: ValueKey('shell-tab-${t.id}'), child: t.child)
      else
        const SizedBox.shrink(),
  ];
}

/// Position of tab [id] among ALL tabs (the `IndexedStack` index), or 0.
int shellStackIndex(List<ShellTab> all, String id) {
  final i = all.indexWhere((t) => t.id == id);
  return i < 0 ? 0 : i;
}

/// Lets a tab's content (the member dashboard's quick actions) switch the
/// shell's selected tab by id. A no-op for an id whose tab is currently
/// filtered off the nav.
class ShellTabController {
  _FlagTabsShellState? _state;

  void select(String id) => _state?._select(id);
}

/// The one body of every role shell: a [SlideDrawerScaffold] with an
/// `IndexedStack` of [tabs] and a [GlassBottomNav], where tabs whose module
/// the gym has switched off are dropped from the nav and their screen is not
/// built (they come from one list, keyed by id). The selection is remembered by tab id, so a tab leaving
/// the nav never re-points it at a neighbour — it falls back to Home — and a
/// flag refresh while the user sits on a now-hidden tab lands them on Home.
class FlagTabsShell extends StatefulWidget {
  const FlagTabsShell({
    required this.tabs,
    required this.drawer,
    this.role = AppRole.staff,
    this.controller,
    super.key,
  });

  /// In nav order; the first is Home (the fallback selection).
  final List<ShellTab> tabs;
  final Widget drawer;
  final AppRole role;
  final ShellTabController? controller;

  @override
  State<FlagTabsShell> createState() => _FlagTabsShellState();
}

class _FlagTabsShellState extends State<FlagTabsShell> {
  late String _tabId = widget.tabs.first.id;

  @override
  void initState() {
    super.initState();
    widget.controller?._state = this;
  }

  @override
  void didUpdateWidget(FlagTabsShell old) {
    super.didUpdateWidget(old);
    if (old.controller != widget.controller) {
      old.controller?._state = null;
      widget.controller?._state = this;
    }
  }

  @override
  void dispose() {
    if (widget.controller?._state == this) widget.controller?._state = null;
    super.dispose();
  }

  void _select(String id) {
    final visible = visibleShellTabs(widget.tabs, context.readTenant);
    if (visible.any((t) => t.id == id)) setState(() => _tabId = id);
  }

  @override
  Widget build(BuildContext context) {
    final tabs = visibleShellTabs(widget.tabs, context.watchTenant);
    final index = shellTabIndex(tabs, _tabId);
    _tabId = tabs[index].id;
    return SlideDrawerScaffold(
      backgroundColor: AppColors.bg,
      drawer: widget.drawer,
      body: SafeArea(
        bottom: false,
        child: IndexedStack(
          index: shellStackIndex(widget.tabs, _tabId),
          children: shellTabChildren(widget.tabs, tabs),
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: GlassBottomNav(
          items: [for (final t in tabs) t.item],
          currentIndex: index,
          role: widget.role,
          onTap: (i) => setState(() => _tabId = tabs[i].id),
        ),
      ),
    );
  }
}
