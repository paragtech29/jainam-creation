// Field-level rules shared by every form, so party, karigar and job work
// cannot drift apart on what counts as a valid name or phone number.
//
// These are the AUTHORITATIVE rules. The forms also carry HTML attributes
// (required, pattern, inputMode, maxLength) as documentation of intent, but
// they no longer validate: the forms are noValidate so that errors appear as
// red text under the field instead of in a browser bubble. Everything that
// reaches a Server Action is checked here, because a Server Action is a
// public endpoint and HTML attributes are trivially bypassed.
//
// Each rule reports exactly ONE message, and checks "did you fill it in?"
// before anything else. A blank field gets "Please enter owner name" —
// telling someone their empty box "must be at least 2 characters" answers a
// question they did not ask.
import { z } from "zod";

const LETTER = /\p{L}/u;

/** "Mobile number" -> "Please enter mobile number" */
function pleaseEnter(label: string) {
  return `Please enter ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

/**
 * A business or trading name. Digits are allowed — "3 Star Creation" is a
 * real kind of name — but the value must contain at least one letter, so a
 * bare "123" is rejected.
 */
export function businessName(label: string) {
  return z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      const fail = (message: string) => ctx.addIssue({ code: "custom", message });
      if (v.length === 0) return fail(pleaseEnter(label));
      if (!LETTER.test(v)) return fail(`${label} must contain letters, not just numbers`);
      if (v.length < 2) return fail(`${label} is too short`);
      if (v.length > 120) return fail(`${label} is too long`);
    });
}

/**
 * A person's name. Letters, spaces and the punctuation that genuinely occurs
 * in names (. ' -) only. No digits at all: an owner called "123" is a typo,
 * never a real answer.
 */
export function personName(label: string) {
  return z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      const fail = (message: string) => ctx.addIssue({ code: "custom", message });
      if (v.length === 0) return fail(pleaseEnter(label));
      if (/[0-9]/.test(v)) return fail(`${label} cannot contain numbers`);
      if (!LETTER.test(v)) return fail(`${label} must contain letters`);
      if (!/^[\p{L}\p{M}\s.'-]+$/u.test(v)) return fail(`${label} can only use letters, spaces, dots, hyphens and apostrophes`);
      if (v.length < 2) return fail(`${label} is too short`);
      if (v.length > 80) return fail(`${label} is too long`);
    });
}

/**
 * A phone number. Accepts the punctuation people actually type — spaces,
 * +, -, brackets — then counts the digits. 10 to 15 covers an Indian mobile,
 * a landline with STD code, and a +91-prefixed number.
 */
export function phone(label: string) {
  return z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      const fail = (message: string) => ctx.addIssue({ code: "custom", message });
      if (v.length === 0) return fail(pleaseEnter(label));
      if (LETTER.test(v)) return fail(`${label} cannot contain letters`);
      if (!/^[0-9+\-\s()]+$/.test(v)) return fail(`${label} can only use numbers, spaces, + - and brackets`);
      const digits = v.replace(/\D/g, "");
      if (digits.length < 10) return fail(`${label} needs at least 10 digits`);
      if (digits.length > 15) return fail(`${label} has too many digits`);
    });
}

/** Same rules, but an empty value is fine. */
export function optionalPhone(label: string) {
  return z.union([z.literal(""), phone(label)]);
}

/** An optional person name — validated only when something was typed. */
export function optionalPersonName(label: string) {
  return z.union([z.literal(""), personName(label)]);
}

/** Free text: address, comments. Length-capped so a paste cannot blow up a row. */
export function optionalText(label: string, max = 500) {
  return z.union([z.literal(""), z.string().trim().max(max, `${label} is too long`)]);
}

/**
 * A required dropdown or date. A disabled or unmounted <select> posts NOTHING,
 * so the key is absent from FormData and a plain z.string() reports
 * "Invalid input: expected string, received undefined" straight to the owner.
 * Coercing a missing value to "" first means the friendly message wins.
 */
export function requiredChoice(message: string) {
  return z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, message)
  );
}

/**
 * Two fields that must not carry the same value — a co-owner who is the same
 * person as the owner, or an "alternate" number identical to the main one.
 * Both were accepted before this existed, which made the second field
 * meaningless: it looked filled in while carrying no new information.
 *
 * Comparison ignores case and surrounding space, so "Amba bhai" and
 * " amba BHAI " are caught. A blank second value is fine — that is simply
 * an optional field left alone.
 */
export function distinctPair(
  ctx: { addIssue: (i: { code: "custom"; message: string; path: (string | number)[] }) => void },
  first: string | undefined,
  second: string | undefined,
  secondPath: string,
  message: string
) {
  const a = (first ?? "").trim().toLowerCase();
  const b = (second ?? "").trim().toLowerCase();
  if (!a || !b) return;
  // Phone numbers are compared on their digits, so "98765 43210" and
  // "9876543210" are recognised as the same number.
  const digitsOnly = (v: string) => v.replace(/\D/g, "");
  const same = a === b || (digitsOnly(a) !== "" && digitsOnly(a) === digitsOnly(b));
  if (same) ctx.addIssue({ code: "custom", message, path: [secondPath] });
}
