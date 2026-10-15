// App logo: three books on a shelf (original inline SVG) plus the app name.
// variant "dark" is for light backgrounds, "light" for dark ones (sidebar, login panel).
import { APP_NAME } from "../../config/app.js";

export default function Logo({ variant = "dark", size = "md", showName = true }) {
  const textColor = variant === "light" ? "text-on-sidebar" : "text-ink";
  const markSize = size === "lg" ? "h-14 w-14" : "h-8 w-8";
  const nameSize = size === "lg" ? "text-3xl" : "text-xl";

  return (
    <span className={`inline-flex items-center gap-2.5 ${textColor}`}>
      <svg viewBox="0 0 32 32" className={markSize} aria-hidden="true">
        <rect x="5" y="8" width="5" height="17" rx="1.5" className="fill-accent" />
        <rect x="12" y="5" width="5" height="20" rx="1.5" className="fill-accent" />
        <rect x="19" y="10" width="5" height="15" rx="1.5" className="fill-accent" transform="rotate(12 21.5 25)" />
        <rect x="3" y="26" width="26" height="2" rx="1" className="fill-current" />
      </svg>
      {showName && <span className={`${nameSize} font-bold tracking-tight`}>{APP_NAME}</span>}
    </span>
  );
}
