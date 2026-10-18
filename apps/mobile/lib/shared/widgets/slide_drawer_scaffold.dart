import 'package:flutter/material.dart';

/// Drop-in replacement for `Scaffold(drawer: ...)` with a plain left-to-
/// right slide-in — Flutter's stock `Drawer`/`DrawerController` has no
/// public API to customize its animation curve, so this builds the
/// slide-in + scrim itself in a plain `Stack` instead of relying on the
/// Navigator-based drawer route Scaffold normally pushes. [MenuButton]
/// opens it via [SlideDrawerController.of], and [AppDrawer]'s own close
/// (✕) / row taps close it the same way — neither calls
/// `Scaffold.of(context)` or `Navigator.pop()` for this, since there's no
/// real Drawer route to pop.
///
/// No edge-swipe-to-open gesture (unlike the stock Drawer) — not asked for;
/// tap-the-scrim, the ✕, the Android back button, and picking a row all
/// close it.
class SlideDrawerScaffold extends StatefulWidget {
  const SlideDrawerScaffold({
    required this.body,
    required this.drawer,
    super.key,
    this.bottomNavigationBar,
    this.backgroundColor,
  });

  final Widget body;
  final Widget drawer;
  final Widget? bottomNavigationBar;
  final Color? backgroundColor;

  @override
  State<SlideDrawerScaffold> createState() => _SlideDrawerScaffoldState();
}

class _SlideDrawerScaffoldState extends State<SlideDrawerScaffold>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 300),
    reverseDuration: const Duration(milliseconds: 250),
  );

  // Kept out of the tree entirely while fully closed, same as the stock
  // Drawer — avoids paying for an offscreen Material/ListView and keeps its
  // rows out of the tab order.
  bool _mounted = false;

  void open() {
    setState(() => _mounted = true);
    _controller.forward(from: 0);
  }

  void close() {
    if (!_mounted) return;
    _controller.reverse().whenCompleteOrCancel(() {
      if (mounted) setState(() => _mounted = false);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final open = _mounted;
    return _SlideDrawerScope(
      state: this,
      child: PopScope(
        canPop: !open,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) close();
        },
        child: Scaffold(
          backgroundColor: widget.backgroundColor,
          body: Stack(
            children: [
              widget.body,
              if (open) ...[
                GestureDetector(
                  onTap: close,
                  child: FadeTransition(
                    opacity: CurvedAnimation(
                      parent: _controller,
                      curve: Curves.easeOut,
                      reverseCurve: Curves.easeIn,
                    ),
                    child: Container(
                      color: const Color(0x8C0A0814), // rgba(10,8,20,.55)
                    ),
                  ),
                ),
                Positioned.fill(
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: SlideTransition(
                      position: Tween<Offset>(
                        begin: const Offset(-1, 0),
                        end: Offset.zero,
                      ).animate(
                        CurvedAnimation(
                          parent: _controller,
                          // Plain decelerating slide, left to right — no
                          // overshoot on open or close.
                          curve: Curves.easeOutCubic,
                          reverseCurve: Curves.easeInCubic,
                        ),
                      ),
                      child: widget.drawer,
                    ),
                  ),
                ),
              ],
            ],
          ),
          bottomNavigationBar: widget.bottomNavigationBar,
        ),
      ),
    );
  }
}

class _SlideDrawerScope extends InheritedWidget {
  const _SlideDrawerScope({required this.state, required super.child});

  final _SlideDrawerScaffoldState state;

  @override
  bool updateShouldNotify(_SlideDrawerScope oldWidget) => false;
}

/// Open/close handle for the nearest ancestor [SlideDrawerScaffold] —
/// [MenuButton]'s counterpart to `Scaffold.of(context).openDrawer()`.
class SlideDrawerController {
  const SlideDrawerController._(this._state);

  final _SlideDrawerScaffoldState _state;

  static SlideDrawerController? of(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<_SlideDrawerScope>();
    if (scope == null) return null;
    return SlideDrawerController._(scope.state);
  }

  void open() => _state.open();

  void close() => _state.close();
}
