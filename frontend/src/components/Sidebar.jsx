// Dark navigation sidebar. Always visible on large screens; a slide-over drawer on small ones.
import { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";
import { NAV_LINKS } from "../config/nav.js";
import Logo from "./ui/Logo.jsx";
import Icon from "./ui/Icon.jsx";
import Button from "./ui/Button.jsx";

// open: is the mobile drawer open. onClose: Escape/backdrop/close button. onNavigate: a link was clicked.
export default function Sidebar({ open, onClose, onNavigate }) {
  const { user, logout } = useAuth();
  const closeButtonRef = useRef(null);

  // Move focus into the drawer when it opens
  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  const links = NAV_LINKS.filter((link) => link.roles.includes(user.role));

  return (
    <>
      {/* Click outside the drawer to close it (mobile only) */}
      {open && <div className="fixed inset-0 z-30 bg-ink/50 lg:hidden" onClick={onClose} aria-hidden="true" />}

      <aside
        id="app-sidebar"
        className={`focus-on-dark fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-on-sidebar transition-[transform,visibility] duration-200 motion-reduce:transition-none lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full max-lg:invisible"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Logo variant="light" />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-11 w-11 items-center justify-center rounded-full text-on-sidebar hover:bg-sidebar-hover focus-ring lg:hidden"
          >
            <Icon name="close" />
          </button>
        </div>

        <nav aria-label="Main" className="flex-1 px-3 py-2">
          <ul className="space-y-1">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-field px-4 py-2 text-sm font-medium focus-ring ${
                      isActive ? "bg-accent text-on-accent" : "text-on-sidebar hover:bg-sidebar-hover"
                    }`
                  }
                >
                  <Icon name={link.icon} />
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-3 py-4">
          <Button variant="ghost" inverted fullWidth onClick={logout} className="justify-start! rounded-field! px-4!">
            <Icon name="logout" />
            Log out
          </Button>
        </div>
      </aside>
    </>
  );
}
