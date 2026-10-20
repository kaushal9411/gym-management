import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/communications/comm_constants.dart';
import 'package:gym_saas_mobile/features/communications/comm_logic.dart';
import 'package:gym_saas_mobile/models/comm_request.dart';

void main() {
  group('message templates', () {
    final presets = CommTemplate.values.where((t) => t != CommTemplate.custom);

    test(
        'every template has starter text that passes the same checks as the API',
        () {
      for (final t in presets) {
        final text = kCommTemplateTexts[t];
        expect(text, isNotNull, reason: '${t.api} has no text');
        expect(text!.title.trim(), isNotEmpty);
        expect(text.title.length, lessThanOrEqualTo(kCommTitleMax));
        expect(text.body.length, lessThanOrEqualTo(kCommBodyMax));
        expect(unknownPlaceholders(text.title), isEmpty, reason: t.api);
        expect(unknownPlaceholders(text.body), isEmpty, reason: t.api);
      }
    });

    test('keys are unique and every non-custom template sits in a group', () {
      final keys = CommTemplate.values.map((t) => t.api).toSet();
      expect(keys.length, CommTemplate.values.length);
      expect(CommTemplate.custom.group, isNull);
      for (final t in presets) {
        expect(t.group, isNotNull, reason: t.api);
      }
    });

    test('offer templates for the season exist', () {
      expect(CommTemplate.specialOffer.api, 'SPECIAL_OFFER');
      expect(CommTemplate.winterOffer.api, 'WINTER_OFFER');
      expect(CommTemplate.winterOffer.group, CommTemplateGroup.offers);
    });
  });
}
