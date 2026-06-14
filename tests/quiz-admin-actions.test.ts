import { beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();
let isAdmin = true;

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// actions.ts now also exports resendQuizReminder, whose import chain
// (quiz-reminder-emails → @/lib/env, @/lib/competition) reads env at module
// load; stub it so this suite stays independent of real env vars.
vi.mock("@/lib/env", () => ({
  env: {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon",
    siteUrl: "http://localhost:3000",
    resendApiKey: null,
    emailFrom: "World Cup Pools <test@example.com>",
    cronSecret: "test-secret",
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { is_admin: isAdmin } })),
        })),
      })),
    })),
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({ insert: insertMock })),
  })),
}));

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

// English question: 3 filled options (slot 3 left blank), correct = slot 1.
function englishFields(): Record<string, string> {
  return {
    prompt: "Who won the 2022 World Cup?",
    option_0: "Argentina",
    option_1: "France",
    option_2: "Brazil",
    option_3: "",
    correct_index: "0",
    active_on: "2026-06-20",
  };
}

beforeEach(() => {
  insertMock.mockReset();
  insertMock.mockResolvedValue({ error: null });
  isAdmin = true;
});

describe("saveQuestion translations", () => {
  it("stores empty translations for an English-only submission", async () => {
    const { saveQuestion } = await import(
      "@/app/[locale]/(admin)/admin/quiz/actions"
    );
    await saveQuestion(makeFormData(englishFields()));

    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = insertMock.mock.calls[0][0];
    expect(row.options).toEqual(["Argentina", "France", "Brazil"]);
    expect(row.correct_index).toBe(0);
    expect(row.translations).toEqual({});
  });

  it("stores ES + FR translations aligned to the filled English options", async () => {
    const { saveQuestion } = await import(
      "@/app/[locale]/(admin)/admin/quiz/actions"
    );
    await saveQuestion(
      makeFormData({
        ...englishFields(),
        es_prompt: "¿Quién ganó el Mundial 2022?",
        es_option_0: "Argentina",
        es_option_1: "Francia",
        es_option_2: "Brasil",
        es_option_3: "", // aligns with the blank English slot 3 — ignored
        fr_prompt: "Qui a gagné la Coupe du monde 2022 ?",
        fr_option_0: "Argentine",
        fr_option_1: "France",
        fr_option_2: "Brésil",
      }),
    );

    const row = insertMock.mock.calls[0][0];
    expect(row.translations).toEqual({
      es: {
        prompt: "¿Quién ganó el Mundial 2022?",
        options: ["Argentina", "Francia", "Brasil"],
      },
      fr: {
        prompt: "Qui a gagné la Coupe du monde 2022 ?",
        options: ["Argentine", "France", "Brésil"],
      },
    });
  });

  it("ignores a fully blank translation block", async () => {
    const { saveQuestion } = await import(
      "@/app/[locale]/(admin)/admin/quiz/actions"
    );
    await saveQuestion(
      makeFormData({
        ...englishFields(),
        es_prompt: "¿Quién ganó el Mundial 2022?",
        es_option_0: "Argentina",
        es_option_1: "Francia",
        es_option_2: "Brasil",
        // fr_* entirely absent
      }),
    );

    const row = insertMock.mock.calls[0][0];
    expect(Object.keys(row.translations)).toEqual(["es"]);
  });

  it("rejects a translation missing an option for a filled English slot", async () => {
    const { saveQuestion } = await import(
      "@/app/[locale]/(admin)/admin/quiz/actions"
    );
    await expect(
      saveQuestion(
        makeFormData({
          ...englishFields(),
          es_prompt: "¿Quién ganó el Mundial 2022?",
          es_option_0: "Argentina",
          es_option_1: "Francia",
          es_option_2: "", // blank but English slot 2 is filled
        }),
      ),
    ).rejects.toThrow(/Incomplete ES translation/);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects a translation prompt without any options", async () => {
    const { saveQuestion } = await import(
      "@/app/[locale]/(admin)/admin/quiz/actions"
    );
    await expect(
      saveQuestion(
        makeFormData({ ...englishFields(), fr_prompt: "Énoncé en français" }),
      ),
    ).rejects.toThrow(/Incomplete FR translation/);
  });

  it("rejects non-admins before inserting", async () => {
    isAdmin = false;
    const { saveQuestion } = await import(
      "@/app/[locale]/(admin)/admin/quiz/actions"
    );
    await expect(saveQuestion(makeFormData(englishFields()))).rejects.toThrow(
      "Admin only",
    );
    expect(insertMock).not.toHaveBeenCalled();
  });
});
