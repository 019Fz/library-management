// Layout for logged-out pages. The header is hidden on /login and /register,
// because those pages are full-screen and show their own logo.
import { Link, Outlet, useLocation } from "react-router-dom";
import Logo from "../components/ui/Logo.jsx";
import Button from "../components/ui/Button.jsx";

const FULL_SCREEN_PAGES = ["/login", "/register"];

export default function GuestLayout() {
  const { pathname } = useLocation();
  const showHeader = !FULL_SCREEN_PAGES.includes(pathname);

  return (
    <div className="min-h-dvh bg-surface">
      {showHeader && (
        <header className="border-b border-line bg-card">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link to="/" aria-label="Home" className="rounded-field focus-ring">
              <Logo />
            </Link>
            <nav aria-label="Account" className="flex items-center gap-2">
              <Button to="/login" variant="ghost" size="sm">
                Log in
              </Button>
              <Button to="/register" size="sm">
                Register
              </Button>
            </nav>
          </div>
        </header>
      )}
      <Outlet />
    </div>
  );
}
