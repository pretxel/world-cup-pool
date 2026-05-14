# Flag SVGs

48 country flags used by the WC2026 pool UI. Each file is named after its ISO 3166-1 alpha-2 code (with the regional codes `gb-eng` and `gb-sct` for England and Scotland).

## Attribution

Sourced from [lipis/flag-icons](https://github.com/lipis/flag-icons) — MIT-licensed flag SVGs by Panayiotis Lipiridis and contributors.

```
MIT License

Copyright (c) 2013 Panayiotis Lipiridis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Adding a new flag

1. Find the ISO code (or `flag-icons` regional code).
2. `curl -fsSL -o public/flags/<code>.svg https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/<code>.svg`
3. Add a row to `lib/team-flag.ts`.
