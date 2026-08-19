import { meetupPlace } from "../../config";
import { Card } from "../components/Card";
import { ErrorText } from "../components/ErrorText";
import { ItemRows, DetailRows } from "../components/Summary";
import { useOrder } from "../store/order";

export function Review({ error }: { error: string | null }) {
  const { state, lines, subtotal } = useOrder();
  const d = state.details;

  const rows: [string, string][] = [
    ["Name", d.name],
    ["Instagram", "@" + d.instagram],
    ["Handover", d.fulfillment === "Meetup" ? `Meetup · ${meetupPlace()}` : "Delivery"],
  ];
  if (d.fulfillment === "Delivery") rows.push(["Address", d.address]);
  if (d.notes) rows.push(["Notes", d.notes]);
  if (d.reference) rows.push(["GCash ref.", d.reference]);
  rows.push(["Proof", state.proofFile ? state.proofFile.name : "—"]);

  return (
    <section aria-labelledby="review-title" className="animate-rise">
      <h2 id="review-title" className="mb-3 font-display text-[1.375rem] font-semibold leading-[1.3]">
        Almost there
      </h2>
      <p className="mb-4.5 text-[.9375rem] text-fg-muted">One last look before you send it over.</p>

      <Card><ItemRows lines={lines} subtotal={subtotal} /></Card>
      <Card><DetailRows rows={rows} /></Card>

      <ErrorText>{error}</ErrorText>
    </section>
  );
}
