import { useEffect, useState } from "react";
import { Button } from "../shop/components/Button";
import { ErrorText } from "../shop/components/ErrorText";
import { INPUT } from "../shop/components/Field";
import { fetchSettings, saveSettings, sendTestEmail } from "../lib/api/admin";
import { ApiError, GENERIC_ERROR } from "../lib/api/http";
import { useAsync } from "./useAsync";
import { Loading, LoadError, PageHeader } from "./components/ui";

/** Matches the server's cap. Ten is a notification list; more is a mailer. */
const MAX_ADDRESSES = 10;

export function Settings() {
  const { data, error, loading, reload } = useAsync((signal) => fetchSettings(signal));

  /* Two copies on purpose. `saved` is what the server currently has, and it is
     what a test email would actually go to — so the difference between the two
     is exactly when the test button must not be trusted. */
  const [saved, setSaved] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]);

  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!data) return;
    setSaved(data.orderNotificationEmails);
    setDraft(data.orderNotificationEmails);
  }, [data]);

  const dirty = JSON.stringify(draft.map((email) => email.trim())) !== JSON.stringify(saved);

  const edit = (index: number, value: string) => {
    setDraft((rows) => rows.map((row, i) => (i === index ? value : row)));
    setRowErrors({});
    setNotice(null);
  };

  const add = () => {
    setDraft((rows) => [...rows, ""]);
    setNotice(null);
  };

  const remove = (index: number) => {
    setDraft((rows) => rows.filter((_, i) => i !== index));
    setRowErrors({});
    setNotice(null);
  };

  async function onSave() {
    /* A blank row is somebody who started typing and stopped, not an address.
       Dropping them here means the positions the server complains about no
       longer line up with the rows on screen, so the map back is kept. */
    const kept = draft
      .map((email, row) => ({ email: email.trim(), row }))
      .filter((entry) => entry.email !== "");

    setSaving(true);
    setRowErrors({});
    setFormError(null);
    setNotice(null);

    try {
      const result = await saveSettings(kept.map((entry) => entry.email));
      setSaved(result.orderNotificationEmails);
      setDraft(result.orderNotificationEmails);
      setNotice(
        result.orderNotificationEmails.length === 0
          ? "Saved. Order notifications are off."
          : "Saved.",
      );
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setFormError(GENERIC_ERROR);
        return;
      }

      const rows: Record<number, string> = {};
      for (const [field, message] of Object.entries(err.fieldErrors)) {
        const position = field.match(/^order_notification_emails\.(\d+)$/)?.[1];
        // A complaint about the list as a whole (too many) has no row to sit by.
        if (position === undefined) { setFormError(message); continue; }
        const entry = kept[Number(position)];
        if (entry) rows[entry.row] = message;
      }

      setRowErrors(rows);
      if (Object.keys(rows).length === 0 && !err.fieldErrors.order_notification_emails) {
        setFormError(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    setTesting(true);
    setFormError(null);
    setNotice(null);

    try {
      const reached = await sendTestEmail();
      setNotice(`Test email sent to ${reached.join(", ")}. Give it a minute, then check the inbox — and the spam folder.`);
    } catch (err) {
      /* The server's message is the provider's own, and it is the only useful
         thing on screen when a key is wrong or a domain isn't verified. */
      setFormError(err instanceof ApiError ? err.message : GENERIC_ERROR);
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <Loading label="Loading your settings…" />;
  if (error) return <LoadError message={error} onRetry={reload} />;

  return (
    <>
      <PageHeader title="Settings" />

      <section className="rounded-card border border-rule bg-surface p-5">
        <h2 className="mt-0 mb-1.5 font-display text-lg font-semibold">Order notifications</h2>
        <p className="mt-0 mb-5 text-[.9375rem] text-fg-muted">
          Everyone here gets an email the moment an order comes in. The receipt
          isn't attached — the email links to the order, so proofs of payment
          stay behind this login.
        </p>

        {draft.length === 0 ? (
          <p className="mb-5 rounded-card border border-dashed border-rule px-4 py-5
                        text-center text-[.9375rem] text-fg-muted">
            Nobody's on the list, so order notifications are off.
          </p>
        ) : (
          <ul className="m-0 mb-4 grid list-none gap-3 p-0">
            {draft.map((email, index) => (
              <li key={index} data-row={index}>
                <div className="flex items-start gap-2">
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    aria-label={`Email address ${index + 1}`}
                    aria-invalid={rowErrors[index] ? true : undefined}
                    value={email}
                    onChange={(e) => edit(index, e.target.value)}
                    placeholder="you@example.com"
                    className={INPUT}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-[7px] flex-none"
                    aria-label={`Remove ${email.trim() || `address ${index + 1}`}`}
                    onClick={() => remove(index)}
                  >
                    Remove
                  </Button>
                </div>
                <ErrorText>{rowErrors[index]}</ErrorText>
              </li>
            ))}
          </ul>
        )}

        {draft.length < MAX_ADDRESSES && (
          <Button variant="ghost" size="sm" onClick={add} className="mb-5">
            Add another address
          </Button>
        )}

        <ErrorText>{formError}</ErrorText>

        {notice && (
          <p role="status" className="mt-1.5 mb-0 text-[.8125rem] text-fg-brand">{notice}</p>
        )}

        <div className="mt-5 flex flex-wrap gap-2.5">
          <Button onClick={() => void onSave()} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save addresses"}
          </Button>

          <Button
            variant="ghost"
            onClick={() => void onTest()}
            disabled={testing || dirty || saved.length === 0}
          >
            {testing ? "Sending…" : "Send test email"}
          </Button>
        </div>

        {dirty && saved.length > 0 && (
          <p className="mt-2.5 mb-0 text-[.8125rem] text-fg-muted">
            Save first — a test goes to the addresses already saved, not the ones on screen.
          </p>
        )}
      </section>
    </>
  );
}
