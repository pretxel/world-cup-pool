import { z } from "zod";

// The three email types the app sends, each with an independent per-player
// on/off preference stored in profiles.email_prefs. Single source of truth so
// the server action, the account-menu toggles, the dispatch paths, and the
// footer unsubscribe routes can't drift apart.
export const EMAIL_PREF_KEYS = [
  "prediction_reminder",
  "result",
  "quiz_reminder",
] as const;

export type EmailPrefKey = (typeof EMAIL_PREF_KEYS)[number];

export type EmailPrefs = Record<EmailPrefKey, boolean>;

// Every type defaults to opted-IN — the features email every eligible player,
// and a profile with no recorded preference should still receive mail.
export const DEFAULT_EMAIL_PREFS: EmailPrefs = {
  prediction_reminder: true,
  result: true,
  quiz_reminder: true,
};

// Validates the payload the account-menu toggles send to updateEmailPrefs: the
// three known boolean keys, all optional so a partial update is allowed.
export const emailPrefsSchema = z
  .object({
    prediction_reminder: z.boolean(),
    result: z.boolean(),
    quiz_reminder: z.boolean(),
  })
  .partial();

export type EmailPrefsInput = z.infer<typeof emailPrefsSchema>;

// Reader semantics shared by every dispatch path: a player is opted in to a
// type unless the stored value is explicitly `false`. A missing key, a null
// column, or a non-boolean value is treated as opted-in, so partial/malformed
// jsonb never silently drops a recipient.
export function isOptedIn(prefs: unknown, key: EmailPrefKey): boolean {
  if (prefs && typeof prefs === "object") {
    const value = (prefs as Record<string, unknown>)[key];
    return value !== false;
  }
  return true;
}

// Normalizes a stored jsonb value into a complete EmailPrefs object for the UI,
// applying default-on for any missing/unknown key.
export function normalizeEmailPrefs(prefs: unknown): EmailPrefs {
  return {
    prediction_reminder: isOptedIn(prefs, "prediction_reminder"),
    result: isOptedIn(prefs, "result"),
    quiz_reminder: isOptedIn(prefs, "quiz_reminder"),
  };
}
