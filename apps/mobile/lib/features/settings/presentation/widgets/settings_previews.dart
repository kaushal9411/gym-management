import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/business_hours.dart';
import '../../../../models/gym_business_settings.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../settings_ui.dart';
import 'business_hours_editor.dart' show dayOf;
import 'settings_fields.dart' show parseHexColor;

/// The settings pages' live previews (web's right-hand column): each one is
/// drawn from the *unsaved* form so the effect of a change is visible before
/// saving. Samples are illustrative, not data.

const _dayShort = {
  'monday': 'Mon',
  'tuesday': 'Tue',
  'wednesday': 'Wed',
  'thursday': 'Thu',
  'friday': 'Fri',
  'saturday': 'Sat',
  'sunday': 'Sun',
};

/// Web's `hoursPerDay`: overnight closes count to the next day.
double hoursForDay(BusinessHoursDay d) {
  if (d.closed) return 0;
  int? m(String? t) {
    final p = (t ?? '').split(':');
    if (p.length < 2) return null;
    final h = int.tryParse(p[0]);
    final mm = int.tryParse(p[1]);
    return h == null || mm == null ? null : h * 60 + mm;
  }

  final o = m(d.open);
  final c = m(d.close);
  if (o == null || c == null) return 0;
  final diff = c >= o ? c - o : c + 1440 - o;
  return (diff / 60 * 10).round() / 10;
}

double weeklyHoursOf(BusinessHours h) =>
    (kWeekdays.fold<double>(0, (s, d) => s + hoursForDay(dayOf(h, d))) * 10)
        .round() /
    10;

class HoursChartCard extends StatelessWidget {
  const HoursChartCard({super.key, required this.hours});

  final BusinessHours hours;

  @override
  Widget build(BuildContext context) {
    final data = [for (final d in kWeekdays) (d, hoursForDay(dayOf(hours, d)))];
    final max = data.fold<double>(1, (m, d) => d.$2 > m ? d.$2 : m);
    final colors = [
      TeamColors.indigo,
      TeamColors.violet,
      TeamColors.teal,
      TeamColors.amber,
      TeamColors.fuchsia,
      TeamColors.green,
      TeamColors.sky,
    ];
    return TeamSectionCard(
      icon: Icons.bar_chart_rounded,
      color: TeamColors.teal,
      title: 'Weekly opening hours',
      subtitle: '${weeklyHoursOf(hours)} hours open per week',
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: SizedBox(
          height: 150,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (var i = 0; i < data.length; i++)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text(
                          data[i].$2 > 0 ? '${data[i].$2}' : '-',
                          style: AppText.tabular(
                            size: 10.5,
                            color: AppColors.inkFaint,
                            weight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Expanded(
                          child: Align(
                            alignment: Alignment.bottomCenter,
                            child: FractionallySizedBox(
                              heightFactor: ((data[i].$2 / max).clamp(0.0, 1.0))
                                  .clamp(data[i].$2 > 0 ? 0.05 : 0.02, 1.0),
                              child: Container(
                                decoration: BoxDecoration(
                                  color: data[i].$2 > 0
                                      ? colors[i]
                                      : AppColors.surface3,
                                  borderRadius: const BorderRadius.vertical(
                                    top: Radius.circular(6),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _dayShort[data[i].$1]!,
                          style: AppText.body(
                            size: 10.5,
                            weight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "How your contact details read together" (web's `BusinessCardPreview`).
class BusinessCardPreview extends StatelessWidget {
  const BusinessCardPreview({
    super.key,
    required this.gymName,
    required this.businessType,
    required this.description,
    required this.email,
    required this.phone,
    required this.website,
    required this.address,
    required this.socialCount,
  });

  final String gymName;
  final String businessType;
  final String description;
  final String email;
  final String phone;
  final String website;
  final String address;
  final int socialCount;

  @override
  Widget build(BuildContext context) {
    final lines = [
      (Icons.mail_outline_rounded, email),
      (Icons.phone_outlined, phone),
      (Icons.public_rounded, website),
      (Icons.place_outlined, address),
    ].where((l) => l.$2.trim().isNotEmpty).toList();
    return TeamSectionCard(
      icon: Icons.badge_outlined,
      color: TeamColors.indigo,
      title: 'Business card',
      subtitle: 'How your contact details read together',
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Container(
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.line),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFF4338CA), Color(0xFF7C3AED)],
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.fitness_center_rounded,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              gymName.trim().isEmpty
                                  ? 'Gym name'
                                  : gymName.trim(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.display(
                                size: 15,
                                color: Colors.white,
                              ),
                            ),
                            Text(
                              businessType.trim().isEmpty
                                  ? 'Business type'
                                  : businessType.trim(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.body(
                                size: 11.5,
                                color: Colors.white.withValues(alpha: 0.82),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (description.trim().isNotEmpty) ...[
                        Text(
                          description.trim(),
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 12,
                            color: AppColors.inkSoft,
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],
                      if (lines.isEmpty)
                        Text(
                          'No contact details yet.',
                          style: AppText.body(
                            size: 12,
                            color: AppColors.inkFaint,
                          ),
                        )
                      else
                        for (final l in lines)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 3),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(l.$1, size: 15, color: AppColors.inkFaint),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    l.$2,
                                    style: AppText.body(size: 12),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      if (socialCount > 0) ...[
                        const SizedBox(height: 6),
                        TeamTag(
                          label: '$socialCount social link'
                              '${socialCount == 1 ? '' : 's'}',
                          color: TeamColors.indigo,
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Web's "Format preview": the selected business settings applied to sample
/// values. The time uses this phone's clock (no time-zone database in the
/// app), so it shows the *format*, not the converted time.
class FormatPreview extends StatelessWidget {
  const FormatPreview({
    super.key,
    required this.currency,
    required this.symbol,
    required this.dateFormat,
    required this.timeFormat,
    required this.weekStartDay,
    required this.unit,
    required this.timezone,
  });

  final String currency;
  final String symbol;
  final String dateFormat;
  final String timeFormat;
  final int weekStartDay;
  final MeasurementUnit unit;
  final String timezone;

  static String formatDate(DateTime d, String fmt) {
    String p(int n) => n.toString().padLeft(2, '0');
    return switch (fmt) {
      'DD/MM/YYYY' => '${p(d.day)}/${p(d.month)}/${d.year}',
      'YYYY-MM-DD' => '${d.year}-${p(d.month)}-${p(d.day)}',
      _ => '${p(d.month)}/${p(d.day)}/${d.year}',
    };
  }

  static String formatTime(DateTime d, String fmt) {
    String p(int n) => n.toString().padLeft(2, '0');
    if (fmt == '24h') return '${p(d.hour)}:${p(d.minute)}';
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    return '$h:${p(d.minute)} ${d.hour >= 12 ? 'PM' : 'AM'}';
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    final start = weekStartDay.clamp(0, 6);
    final week = [for (var i = 0; i < 7; i++) names[(start + i) % 7]];
    return TeamSectionCard(
      icon: Icons.language_rounded,
      color: TeamColors.teal,
      title: 'Format preview',
      subtitle: 'Your selected settings applied to sample values',
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            PreviewRow('Today', formatDate(now, dateFormat)),
            PreviewRow(
              'Time (${timezone.isEmpty ? 'timezone' : timezone})',
              formatTime(now, timeFormat),
            ),
            PreviewRow('Amount', '${symbol}1,234.50'),
            PreviewRow(
              'Amount (ISO)',
              currency.trim().isEmpty ? null : '$currency 1,234.50',
            ),
            PreviewRow(
              'Body metrics',
              unit == MeasurementUnit.imperial
                  ? '159 lb - 69 in'
                  : '72 kg - 175 cm',
            ),
            const SizedBox(height: 6),
            Text(
              'WEEK STARTS ON ${names[start].toUpperCase()}',
              style: AppText.eyebrow(),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                for (var i = 0; i < week.length; i++)
                  Expanded(
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: i == 0 ? TeamColors.teal : AppColors.surface3,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        week[i],
                        style: AppText.body(
                          size: 11,
                          weight: FontWeight.w800,
                          color: i == 0 ? Colors.white : AppColors.inkSoft,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Mini login screen + dashboard drawn from the unsaved colours / theme /
/// welcome message and the saved images (web's `BrandingPreview`).
class BrandingPreview extends StatelessWidget {
  const BrandingPreview({
    super.key,
    required this.primary,
    required this.secondary,
    required this.theme,
    required this.welcome,
    required this.gymName,
    this.logoUrl,
    this.loginBackgroundUrl,
    this.dashboardBannerUrl,
  });

  final String primary;
  final String secondary;

  /// `LIGHT` | `DARK` | `SYSTEM`.
  final String theme;
  final String welcome;
  final String gymName;
  final String? logoUrl;
  final String? loginBackgroundUrl;
  final String? dashboardBannerUrl;

  @override
  Widget build(BuildContext context) {
    final dark = theme == 'DARK' || (theme == 'SYSTEM' && !AppColors.isLight);
    final bg = dark ? const Color(0xFF0B1020) : const Color(0xFFF1F5F9);
    final card = dark ? const Color(0xFF151B2E) : Colors.white;
    final fg = dark ? const Color(0xFFF1F5F9) : const Color(0xFF0F172A);
    final muted = dark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final line = dark ? const Color(0xFF27304A) : const Color(0xFFE2E8F0);
    final p = parseHexColor(primary) ?? TeamColors.indigo;
    final s = parseHexColor(secondary) ?? TeamColors.teal;
    final name = gymName.trim().isEmpty ? 'Your gym' : gymName.trim();

    Widget logo() => (logoUrl != null && logoUrl!.isNotEmpty)
        ? Image.network(
            logoUrl!,
            width: 26,
            height: 26,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => _initial(name, p),
          )
        : _initial(name, p);

    return TeamSectionCard(
      icon: Icons.palette_rounded,
      color: TeamColors.fuchsia,
      title: 'Branding preview',
      subtitle: theme == 'SYSTEM'
          ? 'Following each viewer’s device theme'
          : '${theme.toLowerCase()} theme',
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            Container(
              height: 170,
              decoration: BoxDecoration(
                color: bg,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: line),
                image: (loginBackgroundUrl != null &&
                        loginBackgroundUrl!.isNotEmpty)
                    ? DecorationImage(
                        image: NetworkImage(loginBackgroundUrl!),
                        fit: BoxFit.cover,
                        colorFilter: ColorFilter.mode(
                          Colors.black.withValues(alpha: 0.35),
                          BlendMode.darken,
                        ),
                      )
                    : null,
              ),
              alignment: Alignment.center,
              child: FractionallySizedBox(
                widthFactor: 0.78,
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: card,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [
                      BoxShadow(color: Color(0x33000000), blurRadius: 10),
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          logo(),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.body(
                                size: 12,
                                weight: FontWeight.w800,
                                color: fg,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        welcome.trim().isEmpty
                            ? 'No welcome message set'
                            : welcome.trim(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 11,
                          weight: FontWeight.w700,
                          color: welcome.trim().isEmpty ? muted : fg,
                        ),
                      ),
                      const SizedBox(height: 8),
                      for (var i = 0; i < 2; i++)
                        Container(
                          height: 18,
                          margin: const EdgeInsets.only(bottom: 5),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: line),
                          ),
                        ),
                      Container(
                        height: 22,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: p,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          'Sign in',
                          style: AppText.body(
                            size: 10.5,
                            weight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Container(
              height: 120,
              decoration: BoxDecoration(
                color: bg,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: line),
              ),
              padding: const EdgeInsets.all(8),
              child: Column(
                children: [
                  Expanded(
                    flex: 3,
                    child: Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        gradient: (dashboardBannerUrl == null ||
                                dashboardBannerUrl!.isEmpty)
                            ? LinearGradient(colors: [p, s])
                            : null,
                        image: (dashboardBannerUrl != null &&
                                dashboardBannerUrl!.isNotEmpty)
                            ? DecorationImage(
                                image: NetworkImage(dashboardBannerUrl!),
                                fit: BoxFit.cover,
                              )
                            : null,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Expanded(
                    flex: 2,
                    child: Row(
                      children: [
                        for (final c in [p, s, p])
                          Expanded(
                            child: Container(
                              margin: const EdgeInsets.symmetric(horizontal: 3),
                              decoration: BoxDecoration(
                                color: card,
                                borderRadius: BorderRadius.circular(8),
                                border: Border(
                                  bottom: BorderSide(color: c, width: 3),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Logo and images shown are the ones already uploaded (uploads '
              'save immediately). Colours, theme and message reflect the '
              'unsaved form.',
              style: AppText.body(
                size: 11,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _initial(String name, Color c) => Container(
        width: 26,
        height: 26,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: c,
          borderRadius: BorderRadius.circular(7),
        ),
        child: Text(
          name.isEmpty ? 'G' : name[0].toUpperCase(),
          style: AppText.body(
            size: 12,
            weight: FontWeight.w900,
            color: Colors.white,
          ),
        ),
      );
}

/// Sample invoice header (web's `InvoicePreview`).
class InvoicePreview extends StatelessWidget {
  const InvoicePreview({
    super.key,
    required this.prefix,
    required this.taxPercentage,
    required this.termsDays,
    required this.footer,
    required this.gymName,
  });

  final String prefix;
  final double taxPercentage;
  final int termsDays;
  final String footer;
  final String gymName;

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final due = today.add(Duration(days: termsDays < 0 ? 0 : termsDays));
    const mo = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct',
      'Nov', 'Dec', //
    ];
    String fmt(DateTime d) => '${d.day} ${mo[d.month - 1]} ${d.year}';
    Widget cell(String k, String v) => Expanded(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 3),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.surface3,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  k.toUpperCase(),
                  style: AppText.body(
                    size: 9.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w800,
                  ),
                ),
                Text(v, style: AppText.body(size: 12, weight: FontWeight.w800)),
              ],
            ),
          ),
        );
    return TeamSectionCard(
      icon: Icons.receipt_long_rounded,
      color: TeamColors.green,
      title: 'Invoice preview',
      subtitle: 'Sample header — number and dates are illustrative',
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          gymName.isEmpty ? 'Your gym' : gymName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              AppText.body(size: 14, weight: FontWeight.w900),
                        ),
                        Text(
                          'Invoice',
                          style: AppText.body(
                            size: 11,
                            color: AppColors.inkFaint,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '${prefix.trim().isEmpty ? '---' : prefix.trim()}-000123',
                        style: AppText.tabular(
                          size: 13,
                          weight: FontWeight.w900,
                          color: TeamColors.green,
                        ),
                      ),
                      Text(
                        'Issued ${fmt(today)}',
                        style: AppText.body(
                          size: 11,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  cell(
                    'Payment terms',
                    termsDays > 0 ? 'Net $termsDays days' : 'Due on receipt',
                  ),
                  cell('Due date', fmt(due)),
                ],
              ),
              const SizedBox(height: 10),
              for (final w in [0.7, 0.52])
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Expanded(
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: w,
                          child: Container(
                            height: 8,
                            decoration: BoxDecoration(
                              color: AppColors.surface3,
                              borderRadius: BorderRadius.circular(99),
                            ),
                          ),
                        ),
                      ),
                      Container(
                        width: 40,
                        height: 8,
                        decoration: BoxDecoration(
                          color: AppColors.surface3,
                          borderRadius: BorderRadius.circular(99),
                        ),
                      ),
                    ],
                  ),
                ),
              Divider(color: AppColors.line),
              Row(
                children: [
                  Text(
                    'Tax ($taxPercentage%)',
                    style: AppText.body(
                      size: 12,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w700,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    width: 40,
                    height: 8,
                    decoration: BoxDecoration(
                      color: AppColors.surface3,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                footer.trim().isEmpty ? 'No footer set' : footer.trim(),
                textAlign: TextAlign.center,
                style: AppText.body(size: 11, color: AppColors.inkFaint)
                    .copyWith(fontStyle: FontStyle.italic),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
