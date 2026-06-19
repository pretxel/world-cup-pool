import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getGroup, getGroupBoard } from "@/lib/groups";
import { LeaderboardTable } from "@/components/leaderboard-table";
import {
  DeleteGroupButton,
  InviteByEmail,
  InviteShare,
  LeaveGroupButton,
  RemoveMemberButton,
  RenameGroupForm,
} from "./group-controls";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { ArrowLeftIcon, CrownIcon } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const group = await getGroup(id);
  const t = await getTranslations({ locale, namespace: "groups" });
  return {
    title: group ? `${group.name} · ${t("title")}` : t("title"),
    robots: { index: false },
  };
}

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const t = await getTranslations("groups");

  const group = await getGroup(id);
  if (!group) notFound();

  const { rows } = await getGroupBoard(id);
  const myRow = group.currentUserId
    ? rows.find((r) => r.user_id === group.currentUserId)
    : undefined;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href={localePath(locale, "/groups")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" /> {t("backToGroups")}
      </Link>

      <header className="mb-6 flex flex-col gap-2 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <h1
            className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ fontStretch: "condensed" }}
          >
            {group.name}
          </h1>
          {group.isOwner ? (
            <CrownIcon className="size-5 text-flag" aria-label={t("ownerLabel")} />
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {t("memberCount", { count: group.members.length })}
        </p>
      </header>

      <InviteShare code={group.joinCode} locale={locale} />
      {group.currentUserId ? (
        <InviteByEmail groupId={group.id} locale={locale} />
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {t("boardTitle")}
        </h2>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              {t("boardEmptyTitle")}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              {t("boardEmptyBody")}
            </p>
          </div>
        ) : (
          <LeaderboardTable
            rows={rows}
            currentUserId={group.currentUserId}
            labels={{
              rank: t("boardRank"),
              player: t("boardPlayer"),
              points: t("boardPoints"),
              exact: t("boardExact"),
              winnerGd: t("boardWinnerGd"),
              wins: t("boardWins"),
              you: t("you"),
              noName: t("noName"),
            }}
          />
        )}

        {group.currentUserId && !myRow && rows.length > 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
            {t("notYetRanked")}
          </p>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {t("membersTitle")}
        </h2>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {group.members.map((m) => {
            const isGroupOwner = m.userId === group.ownerId;
            return (
              <li
                key={m.userId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">
                    {m.displayName ?? (
                      <span className="italic text-muted-foreground">
                        {t("noName")}
                      </span>
                    )}
                  </span>
                  {isGroupOwner ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-flag/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-flag">
                      <CrownIcon className="size-3" /> {t("ownerLabel")}
                    </span>
                  ) : null}
                  {m.userId === group.currentUserId ? (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {t("you")}
                    </span>
                  ) : null}
                </div>
                {group.isOwner && !isGroupOwner ? (
                  <RemoveMemberButton
                    groupId={group.id}
                    userId={m.userId}
                    memberName={m.displayName ?? t("noName")}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8 flex flex-col gap-4 border-t border-border pt-6">
        {group.isOwner ? (
          <>
            <RenameGroupForm groupId={group.id} currentName={group.name} />
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{t("deleteHint")}</p>
              <DeleteGroupButton groupId={group.id} locale={locale} />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t("leaveHint")}</p>
            <LeaveGroupButton groupId={group.id} locale={locale} />
          </div>
        )}
      </section>
    </main>
  );
}
