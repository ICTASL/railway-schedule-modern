'use client';

import Image from 'next/image';
import { useId, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  openLabel: string;
  closeLabel: string;
  children: ReactNode;
}

/** Help button plus a modal built on the native <dialog>: focus trapping and Esc come for free. */
export function HelpDialog({ title, openLabel, closeLabel, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        className="help-button"
        aria-label={openLabel}
        onClick={() => dialog.current?.showModal()}
      >
        <Image src="/images/help.png" width={20} height={20} alt="" />
      </button>
      <dialog
        ref={dialog}
        className="help-dialog"
        aria-labelledby={titleId}
        // A click on the backdrop lands on the <dialog> element itself, not on its content.
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="help-dialog__inner">
          <header>
            <h2 id={titleId}>{title}</h2>
            <button type="button" onClick={() => dialog.current?.close()}>
              {closeLabel}
            </button>
          </header>
          <div className="help-dialog__body">{children}</div>
        </div>
      </dialog>
    </>
  );
}
