-- ---------------------------------------------------------------------------
-- match_summaries.image_prompt: a 90s-anime comic-strip image-generation prompt
-- derived from this recap version's `content` (via OpenRouter). Nullable — a
-- recap is fully usable before any image prompt is generated. No backfill and no
-- RLS change: the existing `is_active` SELECT policy already governs the whole
-- row, so the active version's image_prompt is public and drafts stay hidden.
-- ---------------------------------------------------------------------------

alter table public.match_summaries
  add column image_prompt text;
