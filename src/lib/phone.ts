/**
 * Rwandan phone-number rules, shared by the checkout form and the order API so
 * the browser and the server can never disagree about what is acceptable.
 *
 * Rwandan numbers in national form are ten digits beginning `07`
 * (072/073/078/079 …). Internationally they are written +250 7XX XXX XXX, or
 * 2507XXXXXXXX. Landlines begin `0 2x` and are not accepted for delivery -
 * the workshop needs a mobile to call about the order.
 *
 * This module has no "use client" and no Node imports, so both sides can use it.
 */

/** Country code, stripped before matching. */
const COUNTRY = "250";

const NATIONAL_MOBILE = /^07[0-9]{8}$/;
const INTERNATIONAL_MOBILE = /^\+?2507[0-9]{8}$/;
const INTERNATIONAL_NO_TRUNK = /^2507[0-9]{8}$/;

export type PhoneCheck = { ok: true; value: string } | { ok: false; message: string };

/**
 * Reduce any accepted spelling to the ten-digit national form. Returns null
 * when the input is not a Rwandan mobile number.
 */
export function normalizeRwandanPhone(input: string): string | null {
  // Keep digits, plus and spaces; drop brackets, dashes and dots.
  const cleaned = input.trim().replace(/[\s().-]/g, "");

  let digits = cleaned;
  if (digits.startsWith("+")) digits = digits.slice(1);

  if (INTERNATIONAL_NO_TRUNK.test(digits)) {
    return `0${digits.slice(COUNTRY.length)}`;
  }
  if (INTERNATIONAL_MOBILE.test(digits)) {
    return `0${digits.slice(COUNTRY.length)}`;
  }
  // 078… with the trunk 0 doubled by the tel: URI form (+250 0 78…).
  if (digits.startsWith(`${COUNTRY}0`)) digits = digits.slice(COUNTRY.length);
  if (NATIONAL_MOBILE.test(digits)) return digits;

  return null;
}

/** Validate and normalise in one step, with a message fit for a form. */
export function checkRwandanPhone(input: string): PhoneCheck {
  const value = input.trim();
  if (!value) return { ok: false, message: "Enter a phone number we can call you on" };

  const digits = value.replace(/[\s().-]/g, "");
  if (!/^\+?[0-9]{9,15}$/.test(digits)) {
    return { ok: false, message: "A Rwandan number looks like 0784088929" };
  }

  const normalized = normalizeRwandanPhone(value);
  if (!normalized) {
    return {
      ok: false,
      message: "Use a Rwandan mobile number starting 07, e.g. 0784088929",
    };
  }
  return { ok: true, value: normalized };
}

/** How a national number should be printed back to the customer: 078 408 8929. */
export function prettyPhone(national: string): string {
  if (national.length !== 10) return national;
  return `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}