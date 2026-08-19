import { meetupPlace } from "../../config";
import { Field, FieldSet, RadioOption, INPUT, TEXTAREA } from "../components/Field";
import { Callout } from "../components/Card";
import { useOrder } from "../store/order";
import type { Invalid } from "../../lib/validate";

export function Details({ invalid }: { invalid: Invalid | null }) {
  const { state, dispatch } = useOrder();
  const d = state.details;
  const errFor = (field: Invalid["field"]) => (invalid?.field === field ? invalid.message : null);

  const set = (patch: Partial<typeof d>) => dispatch({ type: "setDetails", patch });

  return (
    <section aria-labelledby="details-title" className="animate-rise">
      <h2 id="details-title" className="mb-3 font-display text-[1.375rem] font-semibold leading-[1.3]">
        Your details
      </h2>
      <p className="mb-4.5 text-[.9375rem] text-fg-muted">
        So I know who to reach and where this little one is headed.
      </p>

      <Field label="Name" htmlFor="f-name" error={errFor("name")}>
        <input
          type="text" id="f-name" name="name" autoComplete="name"
          placeholder="Juan dela Cruz" enterKeyHint="next"
          value={d.name}
          onChange={(e) => set({ name: e.target.value })}
          className={`${INPUT} ${errFor("name") ? "border-danger" : ""}`}
        />
      </Field>

      <Field
        label="Instagram handle"
        htmlFor="f-ig"
        hint="This is where I'll message you to confirm."
        error={errFor("ig")}
      >
        <div className={`flex items-center rounded-sm border bg-surface pl-4
                         focus-within:outline-2 focus-within:outline-focus-ring
                         focus-within:outline-offset-1 focus-within:border-brand
                         ${errFor("ig") ? "border-danger" : "border-field"}`}>
          <span aria-hidden="true" className="font-semibold text-fg-muted">@</span>
          <input
            type="text" id="f-ig" name="instagram"
            autoCapitalize="none" autoCorrect="off" spellCheck={false}
            placeholder="yourhandle" enterKeyHint="next"
            value={d.instagram}
            /* Strip a leading "@" as they type — plenty of people paste it in. */
            onChange={(e) => set({ instagram: e.target.value.replace(/^@+/, "") })}
            className="min-h-[52px] w-full border-0 bg-transparent py-3.5 pr-4 pl-1
                       font-[inherit] text-fg placeholder:text-grey-500 focus:outline-none"
          />
        </div>
      </Field>

      <FieldSet legend="How would you like to get it?" error={errFor("fulfillment")}>
        <RadioOption
          id="f-meetup" name="fulfillment" value="Meetup"
          title="Meetup" sub={`${meetupPlace()} · free`}
          checked={d.fulfillment === "Meetup"}
          onChange={() => set({ fulfillment: "Meetup" })}
        />
        <RadioOption
          id="f-delivery" name="fulfillment" value="Delivery"
          title="Delivery" sub="Courier fee shouldered by you"
          checked={d.fulfillment === "Delivery"}
          onChange={() => set({ fulfillment: "Delivery" })}
        />
      </FieldSet>

      {d.fulfillment === "Meetup" && (
        <Callout>
          We'll agree on the exact spot and time at {meetupPlace()} over DM
          once your piece is ready.
        </Callout>
      )}

      {d.fulfillment === "Delivery" && (
        <Field
          label="Delivery address"
          htmlFor="f-address"
          hint="I'll quote the courier fee in your DM before shipping out."
          error={errFor("address")}
        >
          <textarea
            id="f-address" name="address" rows={3} autoComplete="street-address"
            placeholder="House / unit, street, barangay, city, province, ZIP"
            value={d.address}
            onChange={(e) => set({ address: e.target.value })}
            className={`${TEXTAREA} ${errFor("address") ? "border-danger" : ""}`}
          />
        </Field>
      )}

      <Field label="Notes" htmlFor="f-notes" optional>
        <textarea
          id="f-notes" name="notes" rows={3}
          placeholder="Color requests, a name to paint on it, gift wrapping…"
          value={d.notes}
          onChange={(e) => set({ notes: e.target.value })}
          className={TEXTAREA}
        />
      </Field>
    </section>
  );
}
