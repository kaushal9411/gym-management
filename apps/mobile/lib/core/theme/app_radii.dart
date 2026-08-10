/// Border-radius / spacing tokens lifted straight from the design's CSS
/// (`.card{border-radius:20px}`, `.glass{border-radius:22px}`, `.btn{12px}`, `.pill{99px}`).
class AppRadii {
  AppRadii._();

  static const card = 20.0;
  static const glass = 22.0;
  static const field = 14.0;
  static const button = 12.0;
  static const buttonSm = 10.0;
  static const pill = 99.0;
  static const tile = 11.0;
  static const avatar = 13.0;
  static const bottomNav = 22.0;
}

class AppSpacing {
  AppSpacing._();

  static const xs = 6.0;
  static const sm = 8.0;
  static const md = 14.0;
  static const lg = 16.0;
  static const xl = 18.0;
  static const xxl = 24.0;

  /// `.body{ padding: 16px 18px 90px }` — bottom padding clears the floating nav.
  static const screenH = 18.0;
  static const screenTop = 16.0;
  static const screenBottomWithNav = 90.0;
}
