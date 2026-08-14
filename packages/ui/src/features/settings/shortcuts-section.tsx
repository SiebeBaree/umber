import { Keyboard } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '../../components/ui/dialog'

/**
 * The keyboard shortcuts section: a button that opens the full reference in a
 * dialog.
 *
 * Every binding listed here is wired up, and each one lives with the state it
 * drives — navigation in the app shell, the composer's in the composer, the
 * gallery's in the gallery. Nothing goes on this list that does not work.
 */

interface Shortcut {
    readonly label: string
    readonly keys: readonly string[]
}

interface ShortcutGroup {
    readonly title: string
    readonly shortcuts: readonly Shortcut[]
}

const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
    {
        title: 'Navigation',
        shortcuts: [
            { label: 'Go to Create', keys: ['⌘', '1'] },
            { label: 'Go to Gallery', keys: ['⌘', '2'] },
            { label: 'Open Settings', keys: ['⌘', ','] },
        ],
    },
    {
        title: 'Composer',
        shortcuts: [
            { label: 'Focus the prompt', keys: ['/'] },
            { label: 'Switch image ↔ video', keys: ['⌘', '⇧', 'M'] },
            { label: 'Clear finished runs', keys: ['⌘', '⇧', '⌫'] },
        ],
    },
    {
        title: 'Gallery',
        shortcuts: [
            { label: 'Delete creation or selection', keys: ['⌘', '⌫'] },
            { label: 'Select all', keys: ['⌘', 'A'] },
            { label: 'Clear selection', keys: ['Esc'] },
        ],
    },
]

/** One keycap, sized so single glyphs are square and words stay pill-shaped. */
function Key({ children }: { readonly children: ReactNode }) {
    return (
        <kbd className="glass-raised inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-sans text-[12px] font-medium text-ink">
            {children}
        </kbd>
    )
}

function ShortcutRow({ shortcut }: { readonly shortcut: Shortcut }) {
    return (
        <li className="flex items-center justify-between gap-4 py-1.5">
            <span className="text-sm">{shortcut.label}</span>
            <span className="flex items-center gap-1">
                {shortcut.keys.map((key) => (
                    <Key key={key}>{key}</Key>
                ))}
            </span>
        </li>
    )
}

export function ShortcutsSection() {
    return (
        <section aria-labelledby="settings-shortcuts" className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between gap-4">
                <h2 className="font-semibold" id="settings-shortcuts">
                    Keyboard shortcuts
                </h2>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button size="sm" variant="glass">
                            <Keyboard aria-hidden />
                            View shortcuts
                        </Button>
                    </DialogTrigger>
                    <DialogContent aria-describedby={undefined}>
                        <DialogTitle>Keyboard shortcuts</DialogTitle>

                        <div className="-mx-1 mt-4 min-h-0 flex-1 overflow-y-auto px-1">
                            {SHORTCUT_GROUPS.map((group) => (
                                <div className="not-first:mt-5" key={group.title}>
                                    <p className="pb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
                                        {group.title}
                                    </p>
                                    <ul className="divide-y divide-ink/[0.05]">
                                        {group.shortcuts.map((shortcut) => (
                                            <ShortcutRow key={shortcut.label} shortcut={shortcut} />
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </section>
    )
}
