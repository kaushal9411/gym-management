# FitCloud Android — Play Store release guide

End-to-end guide for building the signed Android App Bundle (`.aab`) and uploading it to Google Play (closed testing, then production). Written for whoever cuts the next release.

> **No secrets are stored in this file.** The keystore password lives only in `apps/mobile/android/key.properties` (gitignored) and in your password manager.

---

## 1. Identifiers you will need

| Item | Value |
|---|---|
| App name on Play | FitCloud - Gym Management |
| Package name | `com.fitcloud.gym_saas_mobile` |
| Play Console app page | https://play.google.com/console/u/0/developers/6948862157849850479/app/4976128595215042449 |
| Play "App signing" page | https://play.google.com/console/u/0/developers/6948862157849850479/app/4976128595215042449/keymanagement |
| Firebase project | `fitcloud-gym-management` |
| Production API baked into release builds | `https://api.appkraft.info/api/v1` |
| Flutter project | `apps/mobile` |
| Current version (at time of writing) | `0.1.3+7` (`version:` in `apps/mobile/pubspec.yaml`) |

---

## 2. The signing key (the one thing you must never lose)

Google Play uses **Play App Signing**: Google holds the real app-signing key; **you sign uploads with an *upload key***. Play rejects any bundle not signed by the registered upload key.

**The registered upload key (the original key, created 2026-09-23):**

| Property | Value |
|---|---|
| Keystore file | `~/fitcloud-release-keys/original/fitcloud-original.jks` |
| Format / alias | PKCS12, alias `fitcloud` |
| Valid until | 8 Feb 2054 |
| Certificate SHA-1 | `F9:C4:8A:86:BE:D0:4C:B3:93:50:92:48:AD:28:11:DA:AE:AE:AE:B4` |
| Certificate SHA-256 | `5E:D1:B3:D8:B1:D7:E2:86:FE:41:44:AB:95:34:08:63:1E:2A:05:84:B4:D3:FA:8E:A4:70:86:83:6C:63:0F:2F` |
| Store password | in `apps/mobile/android/key.properties` (`storePassword=`) and your password manager |
| Key password | **same as the store password** (PKCS12 keystores use one password) |

**Everything you must keep (back up in two places outside this computer):**

1. `fitcloud-original.jks` (the keystore file)
2. its password (password manager, *not* next to the file)
3. alias `fitcloud` (written above)

Public/replaceable items: the certificate SHA-1/SHA-256 above, and `upload_certificate.pem` (can always be re-exported from the keystore).

**Never:** commit the keystore or `key.properties`, upload the `.jks` to any website (Play only ever needs the *public* `.pem` certificate), paste the password into chat, or type it into a terminal where it is echoed.

### A second, unused key exists
On 2026-10-17 a second keystore was generated (`~/fitcloud-release-keys/fitcloud-release.jks`, SHA-1 `1F:A6:A9:81:76:25:5A:56:FD:B3:F7:5F:C7:ED:9D:7B:16:D6:68:4F`) before the original was found. It is **not registered with Google** and should not be used. Its properties file is saved as `~/fitcloud-release-keys/key.properties.generated-key`. Do not sign Play uploads with it unless an upload-key reset has been approved (see §8).

---

## 3. One-time setup on a machine

1. **Tools**: Flutter (stable), JDK 17 (`keytool`, `jarsigner`), Android SDK with licences accepted (`flutter doctor --android-licenses`).
2. **Keystore**: copy `fitcloud-original.jks` to e.g. `~/fitcloud-release-keys/original/` (`chmod 600`).
3. **`apps/mobile/android/key.properties`** (gitignored — create it; see `key.properties.example`):

   ```properties
   storePassword=<your keystore password>
   keyPassword=<same password>
   keyAlias=fitcloud
   storeFile=/home/<you>/fitcloud-release-keys/original/fitcloud-original.jks
   ```
   Use an absolute `storeFile` path. `chmod 600` the file.
4. **`apps/mobile/android/app/google-services.json`** (gitignored): Firebase console → Project settings → Your apps → Android app `com.fitcloud.gym_saas_mobile` → *Download google-services.json*. Without it the release build fails at `processReleaseGoogleServices`.

---

## 4. Before every release

- [ ] **Backend deployed first.** Production must already run the API version the app expects, including migrations (`pnpm prisma:deploy` in `apps/api` on the server). The Leads & Enquiries screens, for example, fail against an API without the leads migrations.
- [ ] **Bump the version** in `apps/mobile/pubspec.yaml`: `version: <name>+<code>` (e.g. `0.1.3+7`). The **code (after `+`) must be higher than every code ever uploaded to Play**, even for failed/discarded releases that got as far as the track. Play shows used codes in the bundle table.
- [ ] `flutter analyze` and `flutter test` pass (`apps/mobile`).
- [ ] `key.properties` points at the **original** keystore.

---

## 5. Build the bundle

From `apps/mobile`:

```bash
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://api.appkraft.info/api/v1
```

Output: `apps/mobile/build/app/outputs/bundle/release/app-release.aab`

(`scripts/build-release.sh` does the same and also refuses to run without `key.properties`.)

**Always verify the signature before uploading:**

```bash
keytool -printcert -jarfile build/app/outputs/bundle/release/app-release.aab | grep SHA1
# must print: SHA1: F9:C4:8A:86:BE:D0:4C:B3:93:50:92:48:AD:28:11:DA:AE:AE:AE:B4
```

If it prints anything else (for example `1F:A6:A9:81…`), `key.properties` points at the wrong keystore — fix it and rebuild; Play will reject that file.

Tip: copy the verified file to a clearly named location (e.g. `~/Downloads/fitcloud-v0.1.3-code7.aab`) so you never upload a stale `app-release.aab`.

A sideloadable **APK** (not for Play): `flutter build apk --release --dart-define=API_BASE_URL=https://api.appkraft.info/api/v1` → `build/app/outputs/flutter-apk/app-release.apk` (also signed with the key in `key.properties`; check with `apksigner verify --print-certs`).

---

## 6. Upload to Google Play (closed testing)

1. Play Console → your app → **Test and release → Testing → Closed testing**.
2. **Create new release** (or *Manage track → Create new release*).
3. **Upload** the verified `.aab` (drag-and-drop or *Upload*). Wait for the green check; the table should list the version, e.g. `7 (0.1.3)`.
   - If a red row appears for a different file, remove it with the **X** — only the good bundle should remain.
4. **Release name** (auto-filled from the version) and **Release notes**, e.g.:
   ```
   <en-US>
   Adds Leads & Enquiries for staff: dashboard, lead list, follow-ups, convert to member.
   </en-US>
   ```
5. **Next → review** (fix any errors; warnings such as edge-to-edge are advisory) → **Save** / **Start rollout to Closed testing**.
6. Make sure your **testers list** is attached to this track (Closed testing → Testers) and share the opt-in link with them.
7. Changes go through Google review; closed-testing updates are usually available within hours to a couple of days.

**Promote to production:** Test and release → Production → Create new release → *Copy from closed testing* (or upload the same bundle) → rollout. Production access requires the Play Console closed-testing requirements for your account type to be met.

---

## 7. Optional: distribute outside Play (super-admin App releases)

The platform also serves an APK download through the super-admin **App releases** page (`POST /admin/app-releases`, multipart: `file`, `version`, `versionCode`, `releaseNotes`, `activate`). Use the **APK**, not the `.aab`. Activating a release makes it the build offered to every user, so deploy the matching backend first.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| **"Your Android App Bundle is signed with the wrong key … expected SHA1 `F9:C4:8A:86…` but … `1F:A6:A9:81…`"** | The bundle was signed with the generated (unregistered) key. Point `key.properties` at `fitcloud-original.jks`, rebuild, re-verify with `keytool -printcert -jarfile`. |
| "Version code N has already been used" | Increase the number after `+` in `pubspec.yaml`, rebuild. |
| `processReleaseGoogleServices … google-services.json is missing` | Download `google-services.json` from Firebase and place it in `apps/mobile/android/app/`. |
| Release build fails with a signing / null keystore error | `android/key.properties` missing or wrong path; recreate it (§3). |
| `keystore password was incorrect` | Wrong password. Do not guess repeatedly; recover it from the password manager / the original machine's `key.properties`. |
| `Some Android licenses not accepted` | Run `flutter doctor --android-licenses` and accept. |
| App crashes on start after installing a release build | Usually a missing/incorrect `google-services.json`, or a wrong `API_BASE_URL`. |
| Leads (or any new) screens error in the released app | The production API/DB does not have the new endpoints/migrations yet — deploy the backend (§4). |

### If the original keystore or its password is lost (upload-key reset)
Because Play App Signing is on, a lost upload key is recoverable (not instantly):

1. Generate a new keystore: `keytool -genkeypair -v -keystore upload-keystore.jks -storetype PKCS12 -keyalg RSA -keysize 2048 -validity 10000 -alias upload`
2. Export its public certificate: `keytool -export -rfc -keystore upload-keystore.jks -alias upload -file upload_certificate.pem`
3. Play Console → **App signing** page (link in §1) → **Upload key → Request reset**, choose *I lost my upload key*, upload **`upload_certificate.pem`** (the public file — never the `.jks`).
4. Wait for Google's approval email (typically a few days). Do **not** cancel/resubmit meanwhile, and do not change the *App signing key* section (especially **Change key**).
5. After approval, sign uploads with the new key and update `key.properties`; record the new fingerprint in §2.

If a request is pending and the original key turns up, **Cancel request** (Upload key section) before uploading with the original key, otherwise approval switches the registered key underneath you.

---

## 9. Backup & security checklist

- [ ] `fitcloud-original.jks` copied to **two** locations outside this machine (encrypted drive / private cloud).
- [ ] Keystore password in a password manager (not stored with the file).
- [ ] `key.properties`, `*.jks`, `google-services.json` are gitignored (`git check-ignore -v apps/mobile/android/key.properties`).
- [ ] The password has never been pasted into chat/tickets; if it was shown on screen or shared, treat it as exposed and rotate when convenient (`keytool -storepasswd -keystore <file>`, then update `key.properties`).
- [ ] The Play account owner knows where this document and the backups are.

---

## 10. History

- **2026-09-23** — original upload keystore created (alias `fitcloud`); first Play releases (internal + closed testing) on 2026-09-26.
- **2026-10-17** — keystore password had been forgotten and the first attempt to upload failed with the wrong-key error. A replacement key was generated and an upload-key reset was requested, then the original keystore and password were found; the reset was cancelled and builds were switched back to the original key. Versions 0.1.2+6 (generated key — rejected by Play) and 0.1.3+7 (original key) were built; 0.1.3+7 is the bundle to upload. Lesson: keep the keystore + password backed up and recorded (this document).
