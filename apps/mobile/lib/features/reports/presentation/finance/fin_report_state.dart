import 'dart:async';

import 'package:flutter/material.dart';

import '../kit/kit.dart';
import 'fin_report_parts.dart';

/// State plumbing shared by the four financial report screens: a
/// [RptPeriodController] (period / compare / branch), a [FinRowsLoader] for
/// the result list, "reload when the scope changes", pull-to-refresh and the
/// "Load more failed" snackbar.
///
/// A screen mixes this in, implements [fetchPage], calls [initFin] from
/// `initState` and [disposeFin] from `dispose`, and reads [controls] /
/// [rows] in `build`.
mixin FinReportState<W extends StatefulWidget, T> on State<W> {
  late final RptPeriodController controls;
  late final FinRowsLoader<T> rows;

  /// Bumped by pull-to-refresh so keyed summary / panel widgets reload too.
  int refreshTick = 0;
  String _scope = '';

  /// Fetches one page for the current [controls] (and the screen's extra
  /// filters).
  Future<FinPage<T>> fetchPage(int page);

  /// Extra filters that change the data to fetch (payment status): appended
  /// to the controller's scope so a change reloads the list.
  String get extraScope => '';

  String get _fullScope => '${controls.scope}|$extraScope';

  void initFin() {
    controls = RptPeriodController()..addListener(_onControls);
    rows = FinRowsLoader<T>(fetchPage)..addListener(_onRows);
    unawaited(controls.loadBranches());
    _scope = _fullScope;
    // Not synchronously: the loader notifies, and setState is not allowed
    // from initState.
    scheduleMicrotask(() {
      if (mounted) unawaited(_reloadRows());
    });
  }

  void disposeFin() {
    controls
      ..removeListener(_onControls)
      ..dispose();
    rows
      ..removeListener(_onRows)
      ..dispose();
  }

  Future<void> _reloadRows() async {
    if (!controls.rangeReady) {
      rows.clear();
      return;
    }
    await rows.reload();
  }

  /// Call after changing an extra filter ([extraScope]).
  void filtersChanged() {
    setState(() {});
    if (_fullScope != _scope) {
      _scope = _fullScope;
      unawaited(_reloadRows());
    }
  }

  void _onControls() {
    if (!mounted) return;
    // Compare only decides whether previous figures are shown; everything
    // else (range, branch) changes what we fetch.
    filtersChanged();
  }

  void _onRows() {
    if (!mounted) return;
    setState(() {});
    final failed = rows.moreError;
    if (failed != null) {
      rows.moreError = null;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(failed)));
    }
  }

  /// Pull-to-refresh: reloads the list and re-creates the keyed summary.
  Future<void> refreshAll() async {
    setState(() => refreshTick++);
    await _reloadRows();
  }

  /// `YYYY-MM-DD` local range of the controller as `DateTime`s for the
  /// repositories (which format them back to the same plain day).
  ({DateTime from, DateTime to}) get rangeDates {
    final r = controls.range;
    return (from: DateTime.parse(r.from), to: DateTime.parse(r.to));
  }
}
