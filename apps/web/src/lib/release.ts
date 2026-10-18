import { GITHUB_URL } from "./site";

/*
 * Everything the site knows about shipped builds comes from GitHub releases:
 * the desktop app is published there by `.github/workflows/release.yml`, one
 * installer per platform, named with the version. Because the name moves with
 * every release there is no stable asset URL to hard-code, so the download
 * links are resolved here at request time and cached.
 */

export const GITHUB_REPO = "SiebeBaree/umber";
export const RELEASES_URL = `${GITHUB_URL}/releases`;

// How long a resolved release is reused before GitHub is asked again. Long
// enough that a burst of visitors costs one API call, short enough that a new
// release is offered within the hour.
const REVALIDATE_SECONDS = 1800;

export type Platform = "mac" | "windows" | "linux";

export const PLATFORM_LABELS: Record<Platform, string> = {
  mac: "macOS",
  windows: "Windows",
  linux: "Linux",
};

export type Release = {
  /** The version without its `v` prefix, e.g. `0.1.0`. */
  version: string;
  /** The GitHub release page for these notes. */
  notesUrl: string;
  /** Direct installer URLs, missing for any platform this release skipped. */
  downloads: Partial<Record<Platform, string>>;
};

/*
 * electron-builder emits one installer per platform plus a `.blockmap` and a
 * `latest*.yml` update manifest beside each one. Anchoring on the extension is
 * what keeps `Umber-0.1.0-arm64.dmg.blockmap` from being served to a Mac.
 */
const INSTALLER_EXTENSIONS: Record<Platform, RegExp> = {
  mac: /\.dmg$/i,
  windows: /\.exe$/i,
  linux: /\.AppImage$/i,
};

type GitHubRelease = {
  tag_name: string;
  name: string | null;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  assets: { name: string; browser_download_url: string }[];
};

function headers(): HeadersInit {
  const value: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // Only needed while the repository is private; once it is public the
  // anonymous rate limit is plenty given the cache above. Set it anyway in
  // production and the limit goes from 60 requests an hour to 5000.
  if (process.env.GITHUB_TOKEN) {
    value.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return value;
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${path}`, {
      headers: headers(),
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // A rate limit, an outage or a private repository must not take the page
    // down with it: every caller falls back to the releases page.
    return null;
  }
}

function toRelease(release: GitHubRelease): Release {
  const downloads: Partial<Record<Platform, string>> = {};

  for (const [platform, extension] of Object.entries(INSTALLER_EXTENSIONS)) {
    const asset = release.assets.find((a) => extension.test(a.name));
    if (asset) downloads[platform as Platform] = asset.browser_download_url;
  }

  return {
    version: release.tag_name.replace(/^v/, ""),
    notesUrl: release.html_url,
    downloads,
  };
}

export async function getLatestRelease(): Promise<Release | null> {
  const latest = await get<GitHubRelease>(`${GITHUB_REPO}/releases/latest`);

  if (latest) {
    const release = toRelease(latest);
    if (Object.keys(release.downloads).length > 0) return release;
  }

  // `releases/latest` is whatever was published most recently, which is not
  // necessarily something anyone can install: a release cut by hand, or one
  // published before its build finished uploading, carries no installers.
  // Rather than hand out a dead link, fall back to the newest release that
  // actually has one.
  const all = await get<GitHubRelease[]>(`${GITHUB_REPO}/releases?per_page=20`);

  const withInstallers = all
    ?.filter((r) => !r.draft && !r.prerelease)
    .map(toRelease)
    .find((r) => Object.keys(r.downloads).length > 0);

  return withInstallers ?? (latest ? toRelease(latest) : null);
}

/*
 * Which build to offer a visitor who just clicked "Download". Mobile browsers
 * deliberately resolve to nothing — there is no phone build to hand them, so
 * they are better off on the releases page than downloading a 120 MB dmg.
 */
export function detectPlatform(userAgent: string | null): Platform | null {
  if (!userAgent) return null;
  if (/android|iphone|ipad|ipod/i.test(userAgent)) return null;
  if (/windows|win32|win64/i.test(userAgent)) return "windows";
  // Checked after mobile: an iPad reports "like Mac OS X".
  if (/macintosh|mac os x/i.test(userAgent)) return "mac";
  if (/linux|x11|cros/i.test(userAgent)) return "linux";
  return null;
}

export function parsePlatform(value: string | null): Platform | null {
  return value && value in PLATFORM_LABELS ? (value as Platform) : null;
}
