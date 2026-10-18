import { GITHUB_URL } from "../../lib/site";
import { DownloadButton, GitHubIcon } from "./buttons";
import { Logo } from "./logo";

const LINKS = [
  { href: "#images", label: "Images" },
  { href: "#video", label: "Video" },
  { href: "#templates", label: "Templates" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

/*
 * The app's header, as a site nav: the lockup on the left, a centred glass
 * pill of links and round glass buttons on the right. The glass reads the
 * same on every theme, so the bar needs no background of its own.
 */
export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="relative mx-auto flex h-18 max-w-[1400px] items-center justify-between px-5 sm:px-8">
        <a
          className="glass-bar flex h-11 shrink-0 items-center rounded-full px-4 text-ink"
          href="#top"
        >
          <Logo className="h-7 w-auto" id="nav" />
        </a>
        <nav className="glass-bar absolute left-1/2 hidden h-11 -translate-x-1/2 items-center gap-0.5 rounded-full p-1 text-[13px] font-medium text-ink md:flex">
          {LINKS.map((link) => (
            <a
              className="flex h-full items-center rounded-full px-4 text-ink/70 transition-colors hover:bg-ink/6 hover:text-ink"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            aria-label="Umber on GitHub"
            className="glass-bar hidden size-10 place-items-center rounded-full text-ink transition-colors hover:bg-white sm:grid"
            href={GITHUB_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <GitHubIcon className="size-[18px]" />
          </a>
          <DownloadButton>Download</DownloadButton>
        </div>
      </div>
    </header>
  );
}
