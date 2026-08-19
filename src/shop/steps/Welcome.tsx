import { CONFIG, meetupPlace } from "../../config";
import { Button } from "../components/Button";

const CHIPS = [
  ["🕒", `Made to order · ready in ${CONFIG.leadTime}`],
  ["📍", `Meetup at ${meetupPlace()}`],
  ["📦", "Delivery available · fee shouldered by you"],
] as const;

export function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <section aria-labelledby="welcome-title" className="animate-rise pt-6 text-left">
      <p className="mb-1.5 text-[.8125rem] font-semibold uppercase tracking-[.14em] text-fg-brand">
        {CONFIG.shopName}
      </p>
      <h1 id="welcome-title" className="mb-3 font-display text-2xl font-semibold leading-[1.3] sm:text-[1.75rem]">
        Order your clay miniature
      </h1>
      <p className="mb-5 text-fg-muted">
        Tiny air-dry clay pieces, shaped and painted by hand — one at a time, just for you.
      </p>

      <ul className="my-6 grid list-none gap-2 p-0">
        {CHIPS.map(([icon, text]) => (
          <li key={text}
              className="flex items-center gap-2.5 rounded-sm border border-rule bg-surface
                         px-3.5 py-3 text-[.9375rem] shadow-card">
            <span aria-hidden="true">{icon}</span> {text}
          </li>
        ))}
      </ul>

      <p className="mt-0 mb-1 text-sm text-fg-muted">
        Fill this out and send your proof of payment. I'll confirm your order in a DM.
      </p>

      <div className="mt-[22px] grid gap-2.5">
        <Button onClick={onStart}>Start your order</Button>
      </div>
    </section>
  );
}
