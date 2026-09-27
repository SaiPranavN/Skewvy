'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CloseIcon, PlusIcon, ReceiveIcon, SendIcon } from './icons';

/** At this width and up the menu is a popover; below it, a sheet. */
const POPOVER_QUERY = '(min-width: 640px)';

type Mode = 'popover' | 'sheet';

const CHOICES = [
  {
    key: 'send',
    href: '/moodstamps/send',
    title: 'Send a MoodStamp',
    description: 'Turn appreciation or criticism into something someone can keep.',
    Icon: SendIcon,
  },
  {
    key: 'receive',
    href: '/moodstamps/receive',
    title: 'Receive MoodStamps',
    description: 'Get your personal link and let others send one to you.',
    Icon: ReceiveIcon,
  },
] as const;

/**
 * The + key and the two ways it can start: sending one, or getting a link to
 * receive them.
 *
 * On a wide screen the choices open in a popover pinned under the key. On a
 * phone they open in a sheet from the bottom edge, where a thumb already is,
 * with targets the size of a thumb — a dropdown squeezed onto a phone would be
 * neither.
 *
 * Either way it closes on a choice, a click or tap outside, Escape, or (on a
 * phone) its own close button, and focus goes back to the key unless the
 * person has already moved it somewhere else on purpose.
 */
export function MoodStampCreateMenu() {
  const [mode, setMode] = useState<Mode | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  const restoreFocus = useRef(false);

  const close = useCallback((restore = true) => {
    restoreFocus.current = restore;
    setMode(null);
  }, []);

  // Focus goes back only once the menu is gone: while the sheet is still open,
  // everything behind it is inert and would refuse it. The sheet's own cleanup
  // (closing the dialog) runs before this effect does.
  useEffect(() => {
    if (mode !== null || !restoreFocus.current) return;
    restoreFocus.current = false;
    buttonRef.current?.focus();
  }, [mode]);

  const toggle = () => {
    if (mode) close();
    else setMode(window.matchMedia(POPOVER_QUERY).matches ? 'popover' : 'sheet');
  };

  // Rotating a tablet across the breakpoint would leave the wrong one open.
  useEffect(() => {
    if (!mode) return;
    const query = window.matchMedia(POPOVER_QUERY);
    const onChange = () => close();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [mode, close]);

  return (
    <div className="relative flex-none">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label="Create or receive a MoodStamp"
        aria-expanded={mode !== null}
        aria-controls={mode ? menuId : undefined}
        className="ms-key ms-plus"
      >
        <PlusIcon />
        <span aria-hidden="true" className="hidden sm:inline">
          Create
        </span>
      </button>

      {mode === 'popover' && <Popover id={menuId} buttonRef={buttonRef} onClose={close} />}
      {mode === 'sheet' && <Sheet id={menuId} onClose={close} />}
    </div>
  );
}

function Popover({
  id,
  buttonRef,
  onClose,
}: {
  id: string;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  onClose: (restoreFocus?: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('a')?.focus();

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target || ref.current?.contains(target) || buttonRef.current?.contains(target)) return;
      // Clicking another control is a deliberate move; don't pull focus back from it.
      onClose(!target.closest('a, button, input, select, textarea, [tabindex]'));
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [buttonRef, onClose]);

  // Up and down move between the two choices; Tab out of the menu closes it.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const links = [...(ref.current?.querySelectorAll<HTMLElement>('a') ?? [])];
    const index = links.indexOf(document.activeElement as HTMLElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    links[(index + step + links.length) % links.length]?.focus();
  };

  const onBlur = (event: React.FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (next && !ref.current?.contains(next) && !buttonRef.current?.contains(next)) onClose(false);
  };

  return (
    <div
      ref={ref}
      id={id}
      role="group"
      aria-label="Create or receive a MoodStamp"
      className="ms-popover ms-menu-in"
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <Choices onSelect={() => onClose(false)} />
    </div>
  );
}

/**
 * The sheet is a modal `<dialog>`: the top layer escapes the page wrapper's
 * transform, the page behind goes inert, focus stays inside, and Escape
 * arrives as `cancel`. What it does not do is stop the page scrolling under
 * it, or hand focus back — both are done here.
 */
function Sheet({ id, onClose }: { id: string; onClose: (restoreFocus?: boolean) => void }) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();

    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';

    return () => {
      root.style.overflow = previous;
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      id={id}
      aria-labelledby={titleId}
      className="ms-sheet"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // Escape is handled directly as well: browsers may withhold `cancel` after
      // repeated Escapes without a click in between, which would strand the sheet.
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
      onClick={(event) => {
        // A tap on the dialog itself, not its body, is a tap on the backdrop.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="ms-sheet-body">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">MoodStamps</p>
            <h2 id={titleId} className="display-sm mt-2 text-[24px]">
              Start something
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            aria-label="Close"
            className="grid h-11 w-11 flex-none place-items-center border-2 border-[var(--color-ink)]"
          >
            <CloseIcon />
          </button>
        </div>
        <Choices onSelect={() => onClose(false)} />
      </div>
    </dialog>
  );
}

function Choices({ onSelect }: { onSelect: () => void }) {
  return (
    <div className="grid">
      {CHOICES.map(({ key, href, title, description, Icon }) => (
        <Link key={key} href={href} onClick={onSelect} className="ms-choice" data-choice={key}>
          <span className="ms-choice-icon">
            <Icon />
          </span>
          <span className="min-w-0">
            <span className="block text-[16px] font-extrabold leading-tight">{title}</span>
            <span className="mt-1 block text-[13.5px] leading-snug text-[rgb(23_20_15/0.72)]">{description}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
