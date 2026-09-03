// Field-level rules shared by every form, so party, karigar and job work
// cannot drift apart on what counts as a valid name or phone number.
//
// These are the AUTHORITATIVE rules. The forms also carry HTML attributes
// (required, pattern, inputMode, maxLength) so the browser blocks an obvious
// mistake before a round trip — but those are a convenience. Anything that
// reaches a Server Action is re-checked here, because HTML attributes are
// trivially bypassed and a Server Action is a public endpoint.
import { z } from "zod";

const LETTER = /\p{L}/u;

/**
 * A business or trading name. Digits are allowed — "3 Star Creation" is a
 * real kind of name — but the value must contain at least one letter, so a
 * bare "123" is rejected.
 */
export function businessName(label: string) {
  return z
    .string()
    .trim()
    .min(2, `${label} must be at least 2 characters`)
    .max(120, `${label} is too long`)
    .refine((v) => LETTER.test(v), { message: `${label} must contain letters, not just numbers` });
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
    .min(2, `${label} must be at least 2 characters`)
    .max(80, `${label} is too long`)
    .refine((v) => LETTER.test(v), { message: `${label} must contain letters` })
    .refine((v) => !/[0-9]/.test(v), { message: `${label} cannot contain numbers` })
    .refine((v) => /^[\p{L}\p{M}\s.'-]+$/u.test(v), {
      message: `${label} can only use letters, spaces, dots, hyphens and apostrophes`,
    });
}

/**
 * A phone number. Accepts the punctuation people actually type — spaces,
 * +, -, brackets — then counts the digits. 10 to 15 covers an Indian mobile,
 * a landline with STD code, and a +91-prefixed number. Letters are rejected
 * outright, which was the reported bug: a contact number would accept "abc".
 */
export function phone(label: string) {
  return z
    .string()
    .trim()
    .refine((v) => !LETTER.test(v), { message: `${label} cannot contain letters` })
    .refine((v) => /^[0-9+\-\s()]+$/.test(v), {
      message: `${label} can only use numbers, spaces, + - and brackets`,
    })
    .refine((v) => {
      const digits = v.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    }, { message: `${label} must be 10 to 15 digits` });
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
