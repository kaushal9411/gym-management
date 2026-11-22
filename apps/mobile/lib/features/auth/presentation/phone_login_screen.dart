import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../repositories/public_tenant_repository.dart';
import 'auth_widgets.dart';
import 'phone_otp_screen.dart';

/// Step 1 of "Use phone number": ONE screen for everybody — there is no
/// staff/member switch because nobody has to say who they are. The 10-digit
/// Indian mobile number goes to `POST /public/auth/phone-login/request-otp`
/// (no `actorType`), the server looks for it in both the staff and the member
/// plane of every gym and emails a code to each matching account, and always
/// answers the same generic 200 — it never reveals whether the number has an
/// account. The gym AND the role are only learnt when the code is verified
/// (see [PhoneOtpScreen]).
///
/// Same visual system as [LoginScreen] (see `auth_widgets.dart`): aurora,
/// glass card, shimmer button, shake + haptic on a bad number.
class PhoneLoginScreen extends StatefulWidget {
  const PhoneLoginScreen({super.key});

  @override
  State<PhoneLoginScreen> createState() => _PhoneLoginScreenState();
}

class _PhoneLoginScreenState extends State<PhoneLoginScreen>
    with TickerProviderStateMixin {
  final _phoneController = TextEditingController();
  final _phoneFocus = FocusNode();

  late final AuthMotion _motion = AuthMotion(this);

  bool _loading = false;
  String? _formError;
  String? _phoneError;

  @override
  void initState() {
    super.initState();
    _phoneController.addListener(() => setState(() {}));
    _phoneFocus.addListener(() => setState(() {}));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _motion.syncReducedMotion(context);
  }

  @override
  void dispose() {
    _motion.dispose();
    _phoneController.dispose();
    _phoneFocus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final phone = _phoneController.text.trim();
    if (phone.length != 10) {
      setState(() {
        _formError = null;
        _phoneError = phone.isEmpty
            ? 'Enter your mobile number'
            : 'Enter a valid 10-digit mobile number';
      });
      _motion.failFeedback(context);
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _formError = null;
      _phoneError = null;
    });
    try {
      await getIt<PublicTenantRepository>().requestPhoneOtp(phone: phone);
      if (!mounted) return;
      context.push(AppRoutes.phoneOtp, extra: PhoneOtpScreenArgs(phone: phone));
    } on ApiException catch (e) {
      if (!mounted) return;
      // Maintenance is not a form error — the app-wide Maintenance screen
      // takes over; show nothing here.
      if (e.isMaintenance) return;
      setState(() => _formError = e.message);
      _motion.failFeedback(context);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _backToSignIn() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(AppRoutes.login);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScene(
      motion: _motion,
      hero: AuthHero(
        pulse: _motion.aurora,
        title: 'Use your phone',
        subtitle: 'We\'ll email a one-time code to the account on file',
        icon: Icons.sms_rounded,
      ),
      card: AuthGlassCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AuthErrorSlot(message: _formError),
            GlassField(
              controller: _phoneController,
              focusNode: _phoneFocus,
              label: 'Mobile number',
              hint: '98765 43210',
              accent: kAuthNeutralAccent,
              errorText: _phoneError,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.telephoneNumberNational],
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(10),
              ],
              onSubmitted: (_) => _submit(),
              leading: const Icon(Icons.phone_iphone_rounded, size: 20),
              prefix: const CountryPrefix(),
            ),
            const SizedBox(height: 10),
            const Align(
              alignment: Alignment.centerLeft,
              child: AuthChip(
                label: 'Staff & members · code sent to your email',
                icon: Icons.mark_email_unread_outlined,
              ),
            ),
            const SizedBox(height: 20),
            AuthButton(
              label: 'Send code',
              who: AuthWho.unknown,
              loading: _loading,
              shimmer: _motion.shimmer,
              onPressed: _loading ? null : _submit,
            ),
            const SizedBox(height: 6),
            Center(
              child: AuthLinkButton(
                label: 'Sign in with email or Member ID instead',
                icon: Icons.arrow_back_rounded,
                onTap: _backToSignIn,
              ),
            ),
          ],
        ),
      ),
      footer: const AuthFooter(
        note: 'No need to say whether you are staff or a member —\n'
            'we find your account from your number.',
      ),
    );
  }
}
