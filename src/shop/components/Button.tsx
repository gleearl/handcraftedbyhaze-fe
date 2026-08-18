import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";

/* moss-700 fill + white label = 4.82:1. Never white on moss-500 (2.5:1).
   The focus ring goes dark on primary — a moss ring would sit on a moss button. */
const BASE =
  "inline-flex items-center justify-center rounded-full font-semibold no-underline " +
  "cursor-pointer transition-[transform,background-color] duration-[120ms] ease-out";

const VARIANT = {
  primary:
    "bg-action text-on-action shadow-card active:scale-[.985] active:bg-action-hover " +
    "focus-visible:outline-moss-950 " +
    "disabled:bg-action-disabled disabled:text-on-action-disabled " +
    "disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100",
  ghost:
    "bg-transparent text-fg-brand border border-field active:bg-surface-brand-soft",
} as const;

const SIZE = {
  md: "min-h-[52px] px-[22px]",
  sm: "min-h-10 px-4 text-sm",
} as const;

interface Common {
  variant?: keyof typeof VARIANT;
  size?: keyof typeof SIZE;
  className?: string;
  children: ReactNode;
}

export function Button({
  variant = "primary", size = "md", className = "", children, ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary", size = "md", className = "", children, ...rest
}: Common & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`} {...rest}>
      {children}
    </a>
  );
}
