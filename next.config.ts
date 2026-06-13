import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

const nextConfig: NextConfig = {
  // Emit .next/standalone (server.js + traced node_modules) for a slim Docker
  // runtime image. Ignored by Vercel, which uses its own build output.
  output: "standalone",
  // The OG image routes read subsetted brand fonts from assets/og/ at request
  // time via readFile. Output file tracing can't infer dynamic reads, so list
  // the assets explicitly to guarantee they ship with the serverless bundles.
  outputFileTracingIncludes: {
    "/api/og/rank": ["./assets/og/*.ttf"],
    "/api/og/pick": ["./assets/og/*.ttf"],
  },
};

export default withNextIntl(nextConfig);
