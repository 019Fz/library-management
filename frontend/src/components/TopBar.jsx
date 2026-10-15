// Top bar of the app: menu button (mobile), user name and role, and today's date.
import { useState } from "react";
import { useAuth } from "../context/useAuth.js";
import Badge from "./ui/Badge.jsx";
import Icon from "./ui/Icon.jsx";

export default function TopBar({ menuOpen, onMenuClick, menuButtonRef }) {
  const { user } = useAuth();
  // Worked out once when the bar first appears, not on every render
  const [today] = useState(() =>
    new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
  );

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-card px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface focus-ring lg:hidden"
        >
          <Icon name="menu" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
          <Badge tone={user.role === "admin" ? "accent" : "neutral"} className="mt-0.5">
            {user.role}
          </Badge>
        </div>
      </div>
      <p className="shrink-0 text-sm text-muted">{today}</p>
    </header>
  );
}
