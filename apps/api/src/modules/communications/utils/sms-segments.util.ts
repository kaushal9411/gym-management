/** GSM 03.38 basic character set. */
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
/** Extension table — each costs two septets. */
const GSM_EXTENDED = '^{}\\[~]|€\f';

export interface SmsInfo {
  characters: number;
  segments: number;
  encoding: 'GSM-7' | 'UNICODE';
}

/** Length / segment count of an SMS body (160 / 153 per segment for GSM-7, 70 / 67 for Unicode). */
export function smsInfo(text: string): SmsInfo {
  let septets = 0;
  let gsm = true;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) septets += 1;
    else if (GSM_EXTENDED.includes(ch)) septets += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (gsm) {
    return { characters: septets, segments: septets === 0 ? 0 : septets <= 160 ? 1 : Math.ceil(septets / 153), encoding: 'GSM-7' };
  }
  const units = text.length;
  return { characters: units, segments: units <= 70 ? 1 : Math.ceil(units / 67), encoding: 'UNICODE' };
}
