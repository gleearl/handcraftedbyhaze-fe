import { useEffect, useState } from "react";

const CHIP =
  `inline-flex flex-none items-center rounded-sm border border-rule bg-surface-subtle
   px-1.5 py-0.5 font-mono text-[.6875rem] leading-none tracking-tight text-fg-muted`;

/**
 * The code as plain text, for rows that are themselves one big link.
 *
 * A button nested inside an anchor is invalid markup, and pressing it would
 * copy and navigate at once — so a row like that reads its code here and
 * offers the copyable one on the record's own screen.
 */
export function CodeText({ code, className = "" }: { code: string; className?: string }) {
  if (!code) return null;

  return <span className={`${CHIP} ${className}`}>{code}</span>;
}

/**
 * The short handle a record is filed under — PRD-0007, ORD-0042, EXT-0003.
 *
 * Admin-only by construction: the API sends a code on the admin responses and
 * on none of the public ones, so the shop has nothing to render even by
 * accident. Click to copy, because the usual next thing is pasting it into a
 * message.
 */
export function CodeTag({ code, className = "" }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  /* Clear the confirmation on a timer, and clear the timer if the row goes
     away first — a state update on an unmounted row is a warning, not a crash,
     but the admin's console is worth keeping clean. */
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(timer);
  }, [copied]);

  // Nothing to file it under yet: say nothing rather than show an empty chip.
  if (!code) return null;

  async function copy() {
    try {
      await navigator.clipboard?.writeText(code);
      setCopied(true);
    } catch {
      /* Copying needs a secure context and the browser's permission. Losing
         the copy is a small thing; the code is right there to read. */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Copy code ${code}`}
      title="Copy code"
      className={`${CHIP} cursor-pointer hover:border-brand hover:text-fg-brand ${className}`}
    >
      {copied ? "Copied" : code}
    </button>
  );
}
