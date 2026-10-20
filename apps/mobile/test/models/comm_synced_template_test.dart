import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/models/comm_template.dart';

void main() {
  test('parses the synced template list', () {
    final list = CommSyncedTemplate.listFromJson({
      'items': [
        {
          'type': 'PAYMENT_FAILED',
          'label': 'Payment Failed',
          'title': 'Payment failed',
          'body': 'Pay {{amountDue}}',
        },
      ],
    });
    expect(list, hasLength(1));
    expect(list.single.type, 'PAYMENT_FAILED');
    expect(list.single.body, 'Pay {{amountDue}}');
  });

  test('missing items gives an empty list', () {
    expect(CommSyncedTemplate.listFromJson({}), isEmpty);
  });
}
