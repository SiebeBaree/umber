import {
  detectPlatform,
  getLatestRelease,
  parsePlatform,
  RELEASES_URL,
} from "../../lib/release";

/*
 * The one URL every download button points at. It resolves the newest
 * installer for whoever is asking and redirects to it, so the buttons never
 * carry a version and never go stale.
 *
 * `?os=mac|windows|linux` picks a build explicitly — that is what the platform
 * links under the hero use. Without it the visitor's own platform is read off
 * the User-Agent, which keeps the button working with JavaScript disabled.
 */
export async function GET(request: Request) {
  const requested = parsePlatform(new URL(request.url).searchParams.get("os"));
  const platform =
    requested ?? detectPlatform(request.headers.get("user-agent"));

  const release = platform ? await getLatestRelease() : null;
  const installer = platform ? release?.downloads[platform] : undefined;

  // No build for this platform, or GitHub could not be reached: the releases
  // page always exists and lists every asset, so nobody hits a dead end.
  return new Response(null, {
    status: 302,
    headers: {
      Location: installer ?? RELEASES_URL,
      // The target carries a version, so letting a browser or CDN remember
      // this hop would pin a visitor to whatever release they first saw.
      "Cache-Control": "no-store",
    },
  });
}
