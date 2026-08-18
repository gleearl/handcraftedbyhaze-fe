import { Button } from "./Button";
import { peso } from "../../lib/format";

export function ActionBar({
  showTotal, count, subtotal, label, disabled, onNext,
}: {
  showTotal: boolean; count: number; subtotal: number;
  label: string; disabled: boolean; onNext: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rule
                    bg-[rgba(245,250,242,.94)] px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]
                    backdrop-blur-[10px]">
      <div className="mx-auto flex max-w-[480px] items-center gap-3.5">
        {showTotal && (
          <div className="flex flex-col leading-[1.25]">
            <span className="text-xs text-fg-muted">
              {count === 1 ? "1 item" : `${count} items`}
            </span>
            <span className="text-lg font-bold tabular-nums">{peso(subtotal)}</span>
          </div>
        )}
        <Button className="flex-1" disabled={disabled} onClick={onNext}>{label}</Button>
      </div>
    </div>
  );
}
