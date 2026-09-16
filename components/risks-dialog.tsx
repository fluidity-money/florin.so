'use client';

import { useEffect, useRef } from 'react';
import { RiskList } from './risk-list';

// The risks live in a dialog opened from the foot of the page rather than in
// the top bar. They are something you read once before depositing, not a
// destination you navigate to, and putting them fourth in the nav gave them a
// prominence that pushed the actual product one slot further from the eye.
export function RisksDialog({ label = 'What can go wrong' }: { label?: string }) {
  const ref = useRef<HTMLDialogElement>(null);

  // Native <dialog> gives focus trapping and Esc for free; all that is missing
  // is closing on a backdrop click.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const outside =
        e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      if (outside) el.close();
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, []);

  return (
    <>
      <button type="button" className="risks-trigger" onClick={() => ref.current?.showModal()}>
        <span className="risks-trigger__mark" aria-hidden="true">
          !
        </span>
        <span>
          <strong>{label}</strong>
          <span className="risks-trigger__sub">
            Liquidation, redemption, pool conversion and collateral freeze
          </span>
        </span>
        <span className="risks-trigger__arrow" aria-hidden="true">
          →
        </span>
      </button>

      <dialog ref={ref} className="risks-dialog" aria-labelledby="risks-dialog-title">
        <div className="risks-dialog__head">
          <h2 id="risks-dialog-title">What can go wrong</h2>
          <button
            type="button"
            className="risks-dialog__close"
            onClick={() => ref.current?.close()}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="risks-dialog__body">
          <p className="lead">
            Four things can take your position or your money without you doing
            anything.
          </p>
          <RiskList />
        </div>
      </dialog>
    </>
  );
}
