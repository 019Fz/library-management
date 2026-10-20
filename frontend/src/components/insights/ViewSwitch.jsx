// Admin only: switch between the Platform view and the view of one user. Two real links; the active one has aria-current.
//   mode   = "platform" or "user"
//   userId = the chosen user (kept in the "A user" link, so switching back and forth remembers it), or null
import { Link } from "react-router-dom";

const BASE = "inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold focus-ring";

export default function ViewSwitch({ mode, userId }) {
  const userLink = userId ? `/insights?view=user&userId=${userId}` : "/insights?view=user";
  const items = [
    { key: "platform", label: "Platform", to: "/insights" },
    { key: "user", label: "A user", to: userLink },
  ];

  return (
    <nav aria-label="Insights view" className="inline-flex gap-1 rounded-full border border-line bg-card p-1">
      {items.map((item) => {
        const active = item.key === mode;
        return (
          <Link
            key={item.key}
            to={item.to}
            aria-current={active ? "page" : undefined}
            className={`${BASE} ${active ? "bg-accent text-on-accent" : "text-ink hover:bg-surface"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
