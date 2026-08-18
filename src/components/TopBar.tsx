import { PROGRESS_STEPS } from "../store/order";

/* Sticky, translucent moss-50 over a blur. The fill is moss-700, not the base
   green: it has to read against its own track. */
export function TopBar({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <header className="sticky top-0 z-20 mx-auto flex max-w-[480px] items-center gap-3
                       border-b border-rule bg-[rgba(245,250,242,.92)] px-4 py-2.5
                       backdrop-blur-[8px] sm:rounded-b-card">
      <button
        type="button"
        onClick={onBack}
        aria-label="Go back to the previous step"
        className="-ml-2.5 size-11 flex-none cursor-pointer rounded-full border-0 bg-transparent
                   text-[1.375rem] leading-none text-fg active:bg-surface-brand-soft"
      >
        <span aria-hidden="true">←</span>
      </button>

      <div
        role="progressbar"
        aria-label="Order progress"
        aria-valuemin={1}
        aria-valuemax={PROGRESS_STEPS}
        aria-valuenow={step}
        className="h-[5px] flex-1 overflow-hidden rounded-full bg-grey-200"
      >
        <div
          className="h-full rounded-full bg-moss-700 transition-[width] duration-300 ease-out"
          style={{ width: `${(step / PROGRESS_STEPS) * 100}%` }}
        />
      </div>

      <span className="flex-none text-xs tabular-nums text-fg-muted">
        Step {step} of {PROGRESS_STEPS}
      </span>
    </header>
  );
}
