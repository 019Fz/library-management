// One button for the whole app. With the "to" prop it renders a router link that looks the same.
import { Link } from "react-router-dom";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-60";

const SIZES = {
  sm: "min-h-9 px-4 text-sm",
  md: "min-h-11 px-6 text-base",
};

const VARIANTS = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "bg-ink text-on-ink hover:bg-sidebar-hover",
  outlined: "border border-ink text-ink hover:bg-surface",
  ghost: "text-ink hover:bg-surface",
  danger: "bg-danger text-on-danger hover:bg-danger/90",
};

// Replacements for dark backgrounds (use the "inverted" prop)
const INVERTED = {
  outlined: "border border-on-sidebar text-on-sidebar hover:bg-sidebar-hover",
  ghost: "text-on-sidebar hover:bg-sidebar-hover",
};

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" className="stroke-current opacity-25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" className="stroke-current" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  inverted = false,
  to,
  type = "button",
  disabled = false,
  className = "",
  children,
  ...rest
}) {
  const classes = [
    BASE,
    SIZES[size],
    (inverted && INVERTED[variant]) || VARIANTS[variant],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}
