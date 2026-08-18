/* role="alert" so a screen reader announces the message the moment it appears.
   Renders nothing when empty — the original relied on `.err:empty { display: none }`
   to keep the gap from showing. */
export function ErrorText({ id, children }: { id?: string; children?: string | null }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 mb-0 text-[.8125rem] text-danger">
      {children}
    </p>
  );
}
