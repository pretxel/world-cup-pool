"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/admin/submit-button";
import { cn } from "@/lib/utils";

// Style choices an admin can post. `custom` reveals a free-text instruction that
// is injected into the prompt; the presets carry a fixed server-side fragment.
const PRESET_KEYS = ["neutral", "dramatic", "tactical", "concise"] as const;
type StyleKey = (typeof PRESET_KEYS)[number] | "custom";

export type RegenerateLabels = {
  styleLegend: string;
  presets: Record<(typeof PRESET_KEYS)[number], string>;
  custom: string;
  customPlaceholder: string;
  submit: string;
  pending: string;
};

// Client style-picker that posts to `regenerateMatchSummary`. Always inserts a
// NEW draft version (the public recap is untouched until an admin publishes it).
// Disabled with an explanatory notice when the match has no events to summarize
// or the generator key is unset — both make generation a guaranteed no-op.
export function RegenerateSummaryForm({
  action,
  matchId,
  locale,
  labels,
  disabled = false,
  disabledNotice,
}: {
  action: (formData: FormData) => void | Promise<void>;
  matchId: string;
  locale: string;
  labels: RegenerateLabels;
  disabled?: boolean;
  disabledNotice?: string;
}) {
  const [styleKey, setStyleKey] = React.useState<StyleKey>("neutral");
  const isCustom = styleKey === "custom";

  if (disabled) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {disabledNotice}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="match_id" value={matchId} />
      <input type="hidden" name="locale" value={locale} />

      <fieldset className="space-y-2">
        <legend className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {labels.styleLegend}
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PRESET_KEYS.map((key) => (
            <StyleRadio
              key={key}
              value={key}
              label={labels.presets[key]}
              checked={styleKey === key}
              onSelect={() => setStyleKey(key)}
            />
          ))}
          <StyleRadio
            value="custom"
            label={labels.custom}
            checked={isCustom}
            onSelect={() => setStyleKey("custom")}
          />
        </div>
      </fieldset>

      {isCustom ? (
        <div className="space-y-1.5">
          <Label htmlFor={`style-instruction-${matchId}`} className="text-xs">
            {labels.custom}
          </Label>
          <textarea
            id={`style-instruction-${matchId}`}
            name="style_instruction"
            required
            maxLength={500}
            rows={3}
            placeholder={labels.customPlaceholder}
            className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
      ) : null}

      <SubmitButton size="sm" pendingLabel={labels.pending}>
        {labels.submit}
      </SubmitButton>
    </form>
  );
}

// A radio rendered as a selectable chip. The native input drives `style_key` so
// the posted form carries exactly one value; the surrounding label is the hit
// target and shows the checked state.
function StyleRadio({
  value,
  label,
  checked,
  onSelect,
}: {
  value: StyleKey;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
        checked
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:border-foreground/30",
      )}
    >
      <input
        type="radio"
        name="style_key"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="accent-primary"
      />
      {label}
    </label>
  );
}
