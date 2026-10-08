import { GITHUB_URL } from "../../lib/site";

const SIZES = {
  md: "h-10 px-5 text-sm",
  lg: "h-11 px-5 text-sm sm:h-12 sm:px-7 sm:text-[15px]",
} as const;

/*
 * Points at `/download`, which resolves the newest installer for the
 * visitor's platform and redirects to it. A plain link on purpose: no
 * JavaScript, no version baked into the markup. Styled as the app's primary
 * button; `on-accent` turns it white where the page itself is accent blue.
 */
export function DownloadButton({
  size = "md",
  children = "Download for free",
}: {
  size?: keyof typeof SIZES;
  children?: React.ReactNode;
}) {
  return (
    <a
      className={`group on-accent inline-flex items-center justify-center gap-2 rounded-full whitespace-nowrap bg-accent font-medium text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_8px_20px_-10px_var(--color-accent)] transition-[background-color,scale] duration-200 hover:bg-accent-strong active:scale-[0.97] ${SIZES[size]}`}
      href="/download"
    >
      {children}
      <svg
        aria-hidden="true"
        className="size-4 transition-transform duration-300 group-hover:translate-y-0.5"
        fill="none"
        viewBox="0 0 16 16"
      >
        <path
          d="M8 2v8m0 0 3-3m-3 3L5 7m-2.5 5.5h11"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    </a>
  );
}

/** A glass pill, like the app's secondary controls. */
export function GitHubButton({
  size = "md",
  children = (
    <span>
      <span className="max-sm:hidden">Star on </span>GitHub
    </span>
  ),
}: {
  size?: keyof typeof SIZES;
  children?: React.ReactNode;
}) {
  return (
    <a
      className={`glass-control inline-flex items-center justify-center gap-2.5 rounded-full font-medium whitespace-nowrap text-ink active:scale-[0.97] ${SIZES[size]}`}
      href={GITHUB_URL}
      rel="noopener noreferrer"
      target="_blank"
    >
      <GitHubIcon className="size-4" />
      {children}
    </a>
  );
}

export function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 16 16"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
