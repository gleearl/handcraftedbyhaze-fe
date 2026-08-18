import { CONFIG } from "../../config";
import { Button, ButtonLink } from "../components/Button";
import type { Fulfillment } from "../../lib/api/types";

export function Done({
  fulfillment, onRestart,
}: { fulfillment: Fulfillment | ""; onRestart: () => void }) {
  return (
    <section aria-labelledby="done-title" className="animate-rise pt-6">
      {/* moss-700 + white = 4.82:1. The base green would fail behind the glyph. */}
      <div
        aria-hidden="true"
        className="mb-4.5 grid size-15 animate-pop place-items-center rounded-full
                   bg-action text-[1.75rem] text-fg-inverse"
      >
        ✓
      </div>

      <h2 id="done-title" className="mb-3 font-display text-[1.375rem] font-semibold leading-[1.3]">
        Order received!
      </h2>
      <p className="mb-5 text-fg-muted">
        Thank you! I'll check your payment and confirm your order in an Instagram DM,
        usually within the day.
      </p>

      <ul className="mt-5 grid list-none gap-3 p-0">
        <li className="rounded-sm border border-rule bg-surface px-4 py-3.5 text-[.9375rem]">
          <strong>Made to order.</strong> Your piece takes about a week to shape, dry, and paint.
        </li>
        <li className="rounded-sm border border-rule bg-surface px-4 py-3.5 text-[.9375rem]">
          {fulfillment === "Meetup" ? (
            <>
              <strong>Meetup.</strong> We'll agree on a time and spot at {CONFIG.meetupLocation}{" "}
              once it's ready.
            </>
          ) : (
            <>
              <strong>Delivery.</strong> I'll quote the courier fee in your DM before shipping —
              that part's shouldered by you.
            </>
          )}
        </li>
        <li className="rounded-sm border border-rule bg-surface px-4 py-3.5 text-[.9375rem]">
          <strong>Keep an eye on your DMs</strong> — including your message requests, in case
          we're not following each other yet.
        </li>
      </ul>

      <div className="mt-[22px] grid gap-2.5">
        <ButtonLink
          href={`https://instagram.com/${CONFIG.igHandle}`}
          target="_blank"
          rel="noopener"
        >
          Open Instagram
        </ButtonLink>
        <Button variant="ghost" onClick={onRestart}>Place another order</Button>
      </div>
    </section>
  );
}
