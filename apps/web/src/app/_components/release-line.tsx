import {
  PLATFORM_LABELS,
  type Platform,
  type Release,
} from "../../lib/release";

const PLATFORMS: Platform[] = ["mac", "windows", "linux"];

/*
 * The line under the download buttons: which version is current, and a way
 * to grab a build other than your own. When GitHub cannot be reached the
 * version simply is not there and the platform names still work, because
 * `/download` falls back to the releases page on its own.
 */
export function ReleaseLine({ release }: { release: Release | null }) {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-1 text-xs text-dim tabular-nums">
      {release ? (
        <a
          className="px-2 py-3 transition-colors hover:text-current"
          href={release.notesUrl}
          rel="noopener noreferrer"
          target="_blank"
          title={`Umber ${release.version} release notes`}
        >
          v{release.version}
        </a>
      ) : null}
      {PLATFORMS.map((platform) => (
        <a
          className="px-2 py-3 underline-offset-4 transition-colors hover:text-current hover:underline"
          href={`/download?os=${platform}`}
          key={platform}
        >
          {PLATFORM_LABELS[platform]}
        </a>
      ))}
    </p>
  );
}
