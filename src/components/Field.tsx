import type { ReactNode } from "react";
import { ErrorText } from "./ErrorText";

const LABEL = "mb-2 block text-sm font-semibold";

export const INPUT =
  "w-full min-h-[52px] rounded-sm border border-field bg-surface px-4 py-3.5 " +
  "font-[inherit] text-[length:inherit] text-fg appearance-none " +
  "placeholder:text-grey-500 placeholder:opacity-100 " +
  "focus:outline-2 focus:outline-focus-ring focus:outline-offset-1 focus:border-brand";

export const TEXTAREA = INPUT.replace("min-h-[52px]", "min-h-0") + " resize-y leading-[1.5]";

export function Field({
  label, htmlFor, hint, error, optional, children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mb-5">
      <label className={LABEL} htmlFor={htmlFor}>
        {label}
        {optional && <span className="font-normal text-fg-muted"> (optional)</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 mb-0 text-[.8125rem] text-fg-muted">{hint}</p>}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

/* A fieldset, for the radio group — a <legend> is the accessible label for a
   set of choices in a way a <label> can't be. */
export function FieldSet({
  legend, error, children,
}: { legend: string; error?: string | null; children: ReactNode }) {
  return (
    <fieldset className="mb-5 border-0 p-0">
      <legend className={`${LABEL} p-0`}>{legend}</legend>
      {children}
      <ErrorText>{error}</ErrorText>
    </fieldset>
  );
}

export function RadioOption({
  id, name, value, title, sub, checked, onChange,
}: {
  id: string; name: string; value: string; title: string; sub: string;
  checked: boolean; onChange: () => void;
}) {
  return (
    <label
      htmlFor={id}
      className="mb-2.5 flex cursor-pointer items-center gap-3 rounded-sm border border-field
                 bg-surface px-4 py-3.5 has-checked:border-selected has-checked:bg-surface-brand-soft"
    >
      <input
        type="radio"
        id={id}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        /* accent-color moss-600 — moss-500 is under 3:1 */
        className="m-0 size-[22px] flex-none accent-moss-600"
      />
      <span className="flex flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-[.8125rem] text-fg-muted">{sub}</span>
      </span>
    </label>
  );
}
