"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryParamWriter } from "@/components/use-query-param-writer";
import type { MatchesTab } from "@/lib/match-utils";
import { cn } from "@/lib/utils";

// Client tab strip for the admin /admin/matches workspace. The page stays a
// Server Component and renders each section as a slot; this wrapper only owns the
// interactive tab chrome. The active tab is URL-owned (`?tab=`): `value` is
// parsed server-side and changes are written back here so the view is linkable,
// reload-safe, and lands correctly after a server action redirects.
export function AdminMatchesTabs({
  value,
  labels,
  showReveal,
  fixtures,
  sync,
  reveal,
}: {
  value: MatchesTab;
  labels: { fixtures: string; sync: string; reveal: string };
  showReveal: boolean;
  fixtures: React.ReactNode;
  sync: React.ReactNode;
  reveal: React.ReactNode;
}) {
  const writeParams = useQueryParamWriter();

  // Always write the tab explicitly (base-ui hands back the value). An explicit
  // tab takes precedence over the server's sync/confirm inference, so selecting
  // Fixtures while sync-result params are still in the URL sticks instead of
  // snapping back to Sync.
  const onValueChange = (next: unknown) => {
    writeParams({ tab: String(next) });
  };

  return (
    <Tabs value={value} onValueChange={onValueChange}>
      <TabsList
        className={cn(
          "grid w-full sm:inline-flex sm:w-fit",
          showReveal ? "grid-cols-3" : "grid-cols-2",
        )}
      >
        <TabsTrigger value="fixtures">{labels.fixtures}</TabsTrigger>
        <TabsTrigger value="sync">{labels.sync}</TabsTrigger>
        {showReveal ? (
          <TabsTrigger value="reveal">{labels.reveal}</TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent value="fixtures" className="space-y-8">
        {fixtures}
      </TabsContent>
      <TabsContent value="sync" className="space-y-8">
        {sync}
      </TabsContent>
      {showReveal ? (
        <TabsContent value="reveal" className="space-y-8">
          {reveal}
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
