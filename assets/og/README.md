# OG card fonts (server-only)

Subsetted brand typefaces embedded into the dynamically generated Open Graph
cards (`app/api/og/*`). Loaded via `lib/og-fonts.ts` with `readFile` at request
time (Node runtime) and memoized per warm instance. **Not** served to browsers —
the site loads its fonts via `next/font/google` in `app/layout.tsx`.

## Files

| File | Family | Weight | Notes |
| --- | --- | --- | --- |
| `BricolageGrotesque-Condensed-700.ttf` | Bricolage Grotesque | 700 | opsz 96, wdth 75 (condensed) — display name |
| `BricolageGrotesque-Condensed-800.ttf` | Bricolage Grotesque | 800 | opsz 96, wdth 75 (condensed) — rank number |
| `JetBrainsMono-700.ttf` | JetBrains Mono | 700 | labels + stat values |

Coverage: Basic Latin + Latin-1 Supplement + Latin Extended-A + common
typographic punctuation (covers en/es/fr names; out-of-subset glyphs fall back
to Satori's default font, see `lib/og-fonts.ts`).

## How they were generated

Source variable fonts pulled from `github.com/google/fonts` (`ofl/`), then
instanced to static weights and subsetted with `fonttools`:

```python
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options

UNICODES = list(range(0x20, 0x100)) + list(range(0x100, 0x180)) + \
    [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026]

def make(src, axes, out):
    t = TTFont(src)
    instantiateVariableFont(t, axes, inplace=True)  # e.g. {"opsz":96,"wdth":75,"wght":800}
    ss = Subsetter(options=Options())
    ss.populate(unicodes=UNICODES)
    ss.subset(t)
    t.save(out)
```

To regenerate at a different weight/width, re-run with new `axes` and bump
`CARD_VERSION` in `lib/og-cache.ts` so cached cards refresh.

## License

Both families are licensed under the SIL Open Font License 1.1. Full texts:
`Bricolage-OFL.txt` and `JetBrainsMono-OFL.txt`.
