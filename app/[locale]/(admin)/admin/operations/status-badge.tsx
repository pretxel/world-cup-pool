import { Badge } from "@/components/ui/badge";

// Maps an operation run status to an on-brand badge: success → pitch primary,
// partial → gold accent (the same caution treatment fixtures use for stale),
// error → destructive, anything else (e.g. "never") → muted secondary.
export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  if (status === "success") return <Badge>{label}</Badge>;
  if (status === "error") return <Badge variant="destructive">{label}</Badge>;
  if (status === "partial")
    return (
      <Badge className="border-transparent bg-accent text-accent-foreground">
        {label}
      </Badge>
    );
  return <Badge variant="secondary">{label}</Badge>;
}
