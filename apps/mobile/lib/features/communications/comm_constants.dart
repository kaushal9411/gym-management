import 'package:flutter/material.dart';

import '../../models/comm_channel.dart';
import '../../models/comm_request.dart';

/// Everything Communications screens share that is a fixed fact rather than
/// logic: the channel colours (the approved design's, used everywhere), the
/// API limits, and the placeholder list. One file so the colours can never
/// drift between screens.

// ── channel colours (fixed by the design) ──────────────────────────────────

const kPushColor = Color(0xFF6D4AFF);
const kInAppColor = Color(0xFF0E9F9E);
const kEmailColor = Color(0xFF2F6FED);
const kSmsColor = Color(0xFFE08A00);
const kWhatsAppColor = Color(0xFF1FA855);

/// Brand gradient of the Communications flow (hub tile, primary buttons).
const kCommBrand = Color(0xFF5A3FF0);
const kCommBrand2 = Color(0xFF8A3FE8);
const kCommWarm = Color(0xFFFF6B57);
const kCommGradient = LinearGradient(colors: [kCommBrand, kCommBrand2]);

extension CommChannelUi on CommChannel {
  Color get color => switch (this) {
        CommChannel.push => kPushColor,
        CommChannel.inApp => kInAppColor,
        CommChannel.email => kEmailColor,
        CommChannel.sms => kSmsColor,
        CommChannel.whatsapp => kWhatsAppColor,
      };

  IconData get icon => switch (this) {
        CommChannel.push => Icons.notifications_active_outlined,
        CommChannel.inApp => Icons.inbox_outlined,
        CommChannel.email => Icons.mail_outline_rounded,
        CommChannel.sms => Icons.sms_outlined,
        CommChannel.whatsapp => Icons.chat_outlined,
      };

  /// The line under the name when the channel has no monthly limit.
  String get freeNote => switch (this) {
        CommChannel.push => 'Free, instant',
        CommChannel.inApp => 'Shows in their inbox',
        _ => 'No monthly limit',
      };
}

// ── API limits (docs/COMMUNICATIONS-API.md, "Limits and rules") ─────────────

const kCommTitleMax = 200;
const kCommBodyMax = 2000;

/// `title\nbody` (placeholders filled with sample values) when SMS is used.
const kCommSmsMax = 1000;
const kCommMaxRecipients = 5000;
const kCommLargeSend = 100;
const kCommMaxScheduleDays = 90;
const kCommMinScheduleLeadMinutes = 1;

/// Debounce for the live audience count (the API allows 120 previews/min).
const kCommPreviewDebounce = Duration(milliseconds: 350);

/// Placeholders a campaign may use, in the order the chips show them.
const kCommPlaceholders = <String>[
  'firstName',
  'lastName',
  'memberCode',
  'planName',
  'endDate',
  'amountDue',
  'gymName',
];

/// Sample values used by the live preview (the same ones the API's test-send
/// fills in), so what staff see matches what a test message looks like.
const kCommSampleVars = <String, String>{
  'firstName': 'Aarav',
  'lastName': 'Kapoor',
  'memberCode': 'MEM-0001',
  'planName': 'Monthly',
  'endDate': '26 Oct 2026',
  'amountDue': '₹1,500',
  'gymName': 'Your Gym',
};

/// Quiet hours note (SMS + WhatsApp are held overnight in the member's
/// branch time zone).
const kCommQuietNote =
    'SMS and WhatsApp are not sent between 9 pm and 8 am (the member\'s '
    'branch time). They wait and go out at 8 am.';

/// The API's own caveat for WhatsApp free-text (docs: "Known limitations").
const kCommWhatsAppNote =
    'WhatsApp only delivers free-text messages to members who wrote to your '
    'number in the last 24 hours. Others are reported as failed.';

/// Preset texts for the template chips. The text is plain campaign
/// placeholders — `templateKey` is only a label.
class CommTemplateText {
  const CommTemplateText(this.title, this.body);
  final String title;
  final String body;
}

const kCommTemplateTexts = <CommTemplate, CommTemplateText>{
  CommTemplate.expiring: CommTemplateText(
    '{{firstName}}, your {{planName}} plan ends {{endDate}}',
    'Your {{planName}} membership at {{gymName}} ends on {{endDate}}. '
        'Renew at the front desk or in the app to keep training without a '
        'break.',
  ),
  CommTemplate.overdue: CommTemplateText(
    'Payment reminder from {{gymName}}',
    'Hi {{firstName}}, you have {{amountDue}} pending. Please pay in the app '
        'or at the front desk.',
  ),
  CommTemplate.classUpdate: CommTemplateText(
    'New class at {{gymName}}',
    'Hi {{firstName}}, we have added a new class to the timetable. Open the '
        'app to see the schedule and book your spot.',
  ),
  CommTemplate.specialOffer: CommTemplateText(
    'A special offer for you, {{firstName}}',
    'Hi {{firstName}}, {{gymName}} has a special offer for members this week. Ask at the front desk or open the app to claim it before it ends.',
  ),
  CommTemplate.winterOffer: CommTemplateText(
    'Winter offer at {{gymName}}',
    'Hi {{firstName}}, beat the winter chill with our winter offer. Stay consistent through the cold months and ask at the front desk for the details. Valid for a limited time.',
  ),
  CommTemplate.summerOffer: CommTemplateText(
    'Summer offer at {{gymName}}',
    'Hi {{firstName}}, get summer-ready with our summer offer. Ask at the front desk or in the app for the details. Valid for a limited time.',
  ),
  CommTemplate.festiveOffer: CommTemplateText(
    'Festive greetings from {{gymName}}',
    'Hi {{firstName}}, celebrate the season with a festive offer on memberships. Visit the front desk to know more. Valid for a limited time.',
  ),
  CommTemplate.renewalOffer: CommTemplateText(
    'Renew early, {{firstName}}',
    'Your {{planName}} plan ends on {{endDate}}. Renew before it ends to get a renewal benefit. Ask at the front desk or renew in the app.',
  ),
  CommTemplate.referFriend: CommTemplateText(
    'Bring a friend to {{gymName}}',
    'Hi {{firstName}}, train better together. Refer a friend and ask at the front desk about our referral reward.',
  ),
  CommTemplate.comeback: CommTemplateText(
    'We miss you, {{firstName}}',
    'It has been a while since your last visit. Come back this week and we will help you restart your routine. Your {{planName}} plan is active until {{endDate}}.',
  ),
  CommTemplate.holidayNotice: CommTemplateText(
    'Holiday notice from {{gymName}}',
    'Hi {{firstName}}, {{gymName}} will be closed on the upcoming holiday and will reopen on the next working day. Plan your workout accordingly.',
  ),
  CommTemplate.timingChange: CommTemplateText(
    'Gym timing change',
    'Hi {{firstName}}, our gym timings are changing. Please check the app for the new opening hours.',
  ),
  CommTemplate.feedback: CommTemplateText(
    'How are we doing, {{firstName}}?',
    'Tell us what you like and what we can improve at {{gymName}}. Share your feedback with the front desk or your trainer.',
  ),
};
