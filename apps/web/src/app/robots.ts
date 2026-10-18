import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // A redirect to the current GitHub installer, with nothing of its own to
        // index. Crawlers following it would only download the app.
        "/download",
        // The PostHog proxy. Nothing to index, and crawling it would bill us
        // for junk events.
        "/relay",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
