'use client';

import { useEffect, useRef } from 'react';

/**
 * A modal dialog built on the native `<dialog>` element.
 *
 * `showModal()` puts it in the top layer, so it escapes the transformed page
 * wrapper without a portal, makes the rest of the page inert, keeps focus
 * inside, and turns Escape into a `cancel` event. What it does not do reliably
 * across browsers is hand focus back, so the element that opened it is
 * remembered and refocused on close.
 *
 * `dismissible` goes false while a request is in flight: closing the dialog
 * mid-request would hide the outcome of an action the person already took.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  describedBy,
  initialFocus,
  dismissible = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  initialFocus?: React.RefObject<HTMLElement | null>;
  dismissible?: boolean;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      initialFocus?.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocus.current?.focus();
      returnFocus.current = null;
    }
  }, [open, initialFocus]);

  // Unmounting while open must not strand focus on a node that no longer exists.
  useEffect(
    () => () => {
      returnFocus.current?.focus();
    },
    [],
  );

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="modal on-paper"
      onCancel={(event) => {
        // Escape. The dialog would close itself; React state must decide instead.
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(event) => {
        // A click that lands on the dialog element itself is a click on the backdrop.
        if (event.target === event.currentTarget && dismissible) onClose();
      }}
    >
      {open && <div className="modal-body">{children}</div>}
    </dialog>
  );
}
