import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/profile_photo.dart';
import '../../../team/presentation/widgets/team_ui.dart';

/// `#rrggbb` -> Color, or null for anything else. Web also accepts oklch / rgb
/// / named colours in the text field; those save as typed but can't be drawn
/// here, so they show a neutral swatch.
Color? parseHexColor(String? v) {
  final s = (v ?? '').trim();
  final m = RegExp(r'^#([0-9a-fA-F]{6})$').firstMatch(s);
  if (m == null) return null;
  return Color(0xFF000000 | int.parse(m.group(1)!, radix: 16));
}

String hexOf(Color c) =>
    '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

const kBrandSwatches = <Color>[
  Color(0xFF4F46E5),
  Color(0xFF7C3AED),
  Color(0xFFC026D3),
  Color(0xFFE11D48),
  Color(0xFFF97316),
  Color(0xFFF59E0B),
  Color(0xFF10B981),
  Color(0xFF14B8A6),
  Color(0xFF0EA5E9),
  Color(0xFF334155),
];

/// Web's `ColorPicker` on the phone: a swatch, the raw colour text (any CSS
/// colour, saved exactly as typed) and a row of preset swatches (the browser's
/// native picker has no phone equivalent in this app).
class ColorField extends StatelessWidget {
  const ColorField({
    super.key,
    required this.label,
    required this.controller,
    required this.onChanged,
    this.disabled = false,
  });

  final String label;
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final c = parseHexColor(controller.text);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(), style: AppText.eyebrow()),
        const SizedBox(height: 6),
        Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: c ?? TeamColors.slate,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.line),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                controller: controller,
                enabled: !disabled,
                onChanged: onChanged,
                style: AppText.tabular(size: 14, weight: FontWeight.w700),
                decoration: InputDecoration(
                  hintText: '#4f46e5 or oklch(0.51 0.23 277)',
                  hintStyle: AppText.body(size: 13, color: AppColors.inkFaint),
                  filled: true,
                  fillColor: AppColors.surface3,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadii.field),
                    borderSide: BorderSide(color: AppColors.line),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadii.field),
                    borderSide: BorderSide(color: AppColors.line),
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final s in kBrandSwatches)
              Semantics(
                button: true,
                label: 'Use ${hexOf(s)}',
                child: GestureDetector(
                  onTap: disabled
                      ? null
                      : () {
                          controller.text = hexOf(s);
                          onChanged(controller.text);
                        },
                  child: Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: s,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: controller.text.toLowerCase() == hexOf(s)
                            ? AppColors.ink
                            : Colors.transparent,
                        width: 2,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// One brand image (web's `ImageUploadField`): preview, description and an
/// Upload / Replace button. The picture is chosen with the camera or gallery,
/// shrunk to [maxDimension] and sent as a base64 `data:` URL — the API's 1 MB
/// body cap applies, so oversized pictures are refused with a clear message.
/// Like web, an upload saves immediately.
class BrandImageField extends StatefulWidget {
  const BrandImageField({
    super.key,
    required this.label,
    required this.url,
    required this.maxDimension,
    required this.onUpload,
    this.description,
    this.wide = false,
    this.disabled = false,
  });

  final String label;
  final String? description;
  final String? url;
  final int maxDimension;
  final bool wide;
  final bool disabled;

  /// Receives the data URL; throw to report a failure.
  final Future<void> Function(String dataUrl) onUpload;

  @override
  State<BrandImageField> createState() => _BrandImageFieldState();
}

class _BrandImageFieldState extends State<BrandImageField> {
  bool _busy = false;

  Future<void> _pick() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: AppColors.surface2,
      constraints: const BoxConstraints(maxWidth: 640),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Take a photo'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose from gallery'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (source == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final picked = await ImagePicker().pickImage(
        source: source,
        maxWidth: widget.maxDimension.toDouble(),
        maxHeight: widget.maxDimension.toDouble(),
        imageQuality: 85,
      );
      if (picked == null) return;
      final dataUrl = buildPhotoDataUrl(await picked.readAsBytes());
      await widget.onUpload(dataUrl);
    } on ProfilePhotoException catch (e) {
      if (mounted) teamSnack(context, e.message, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final url = widget.url;
    final w = widget.wide ? 112.0 : 64.0;
    final h = widget.wide ? 64.0 : 64.0;
    return Row(
      children: [
        Container(
          width: w,
          height: h,
          decoration: BoxDecoration(
            color: AppColors.surface3,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.line),
          ),
          clipBehavior: Clip.antiAlias,
          child: url == null || url.isEmpty
              ? Icon(Icons.image_outlined, color: AppColors.inkFaint)
              : Image.network(
                  url,
                  fit: widget.wide ? BoxFit.cover : BoxFit.contain,
                  errorBuilder: (_, __, ___) => Icon(
                    Icons.broken_image_outlined,
                    color: AppColors.inkFaint,
                  ),
                ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.label,
                style: AppText.body(size: 13.5, weight: FontWeight.w800),
              ),
              if (widget.description != null)
                Text(
                  widget.description!,
                  style: AppText.body(
                    size: 11.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        OutlinedButton.icon(
          onPressed: (_busy || widget.disabled) ? null : _pick,
          icon: _busy
              ? const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.upload_rounded, size: 16),
          label: Text(url == null || url.isEmpty ? 'Upload' : 'Replace'),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.ink,
            side: BorderSide(color: AppColors.line),
            visualDensity: VisualDensity.compact,
          ),
        ),
      ],
    );
  }
}
