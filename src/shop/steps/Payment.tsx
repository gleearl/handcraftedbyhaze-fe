import { useState } from "react";
import { CONFIG } from "../../config";
import { Card, CardLabel, Callout } from "../components/Card";
import { Button } from "../components/Button";
import { Field, INPUT } from "../components/Field";
import { ItemRows } from "../components/Summary";
import { UploadBox } from "../components/UploadBox";
import { useOrder } from "../store/order";
import type { Invalid } from "../../lib/validate";

export function Payment({ invalid }: { invalid: Invalid | null }) {
  const { state, dispatch, lines, subtotal } = useOrder();
  const [copied, setCopied] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  const error = proofError ?? (invalid?.field === "proof" ? invalid.message : null);

  async function copyNumber() {
    // Digits only — a pasted "0966 415 3057" gets rejected by some number fields.
    const number = CONFIG.gcashNumber.replace(/\s+/g, "");
    try {
      await navigator.clipboard.writeText(number);
    } catch {
      // Older Safari and any non-secure context: fall back to the old trick.
      const tmp = document.createElement("textarea");
      tmp.value = number;
      tmp.setAttribute("readonly", "");
      tmp.style.position = "absolute";
      tmp.style.left = "-9999px";
      document.body.appendChild(tmp);
      tmp.select();
      try { document.execCommand("copy"); } catch { /* nothing left to try */ }
      document.body.removeChild(tmp);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section aria-labelledby="payment-title" className="animate-rise">
      <h2 id="payment-title" className="mb-3 font-display text-[1.375rem] font-semibold leading-[1.3]">
        Payment
      </h2>
      <p className="mb-4.5 text-[.9375rem] text-fg-muted">
        Send the item total via GCash, then upload your receipt below.
      </p>

      <Card tone="total">
        <ItemRows lines={lines} subtotal={subtotal} />
      </Card>

      <Card>
        <CardLabel>GCash</CardLabel>
        <p className="m-0 font-display text-xl font-semibold">{CONFIG.gcashName}</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="text-lg font-semibold tabular-nums tracking-[.04em]">
            {CONFIG.gcashNumber}
          </span>
          <Button variant="ghost" size="sm" onClick={copyNumber}>
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
        <img
          className="mx-auto mt-4 h-auto w-[270px]"
          src={CONFIG.gcashQr} alt="GCash QR code" width={437} height={600}
        />
      </Card>

      <Callout tone="warm">
        Please send the item total only. If you chose delivery, I'll quote the courier
        fee in your DM and we'll settle it separately.
      </Callout>

      <Field label="GCash reference number" htmlFor="f-ref" optional>
        <input
          type="text" id="f-ref" name="reference" inputMode="numeric" autoComplete="off"
          placeholder="e.g. 1029 384 756 21"
          value={state.details.reference}
          onChange={(e) => dispatch({ type: "setDetails", patch: { reference: e.target.value } })}
          className={INPUT}
        />
      </Field>

      <UploadBox
        file={state.proofFile}
        onFile={(file) => dispatch({ type: "setProof", file })}
        error={error}
        onError={setProofError}
      />
    </section>
  );
}
