import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Every transactional sender must set a Reply-To (deliverability: a no-reply /
// reply-less From lowers inbox trust). Guard each sender module's Resend
// payload against shipping without `replyTo: env.emailReplyTo`.

const SENDERS = [
  "result-emails",
  "prediction-reminder-emails",
  "quiz-reminder-emails",
  "results-digest-emails",
  "recap-digest-emails",
  "comeback-emails",
  "welcome-email",
  "group-invite-email",
];

describe("transactional senders set Reply-To", () => {
  for (const name of SENDERS) {
    it(`${name} includes replyTo: env.emailReplyTo`, () => {
      const src = readFileSync(
        join("lib", "notifications", `${name}.ts`),
        "utf8",
      );
      expect(src).toContain("replyTo: env.emailReplyTo");
    });
  }
});
