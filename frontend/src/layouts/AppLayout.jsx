// Layout for logged-in pages: dark sidebar, top bar and the page content.
import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import TopBar from "../components/TopBar.jsx";

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);

  // Close the drawer and give focus back to the menu button
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  // Escape closes the drawer
  useEffect(() => {
    if (!menuOpen) return;
    function handleKey(event) {
      if (event.key === "Escape") closeMenu();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [menuOpen, closeMenu]);

  // If the window grows to desktop size, forget that the drawer was open
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64rem)");
    function handleChange(event) {
      if (event.matches) setMenuOpen(false);
    }
    desktop.addEventListener("change", handleChange);
    return () => desktop.removeEventListener("change", handleChange);
  }, []);

  return (
    <div className="min-h-dvh bg-surface">
      <Sidebar open={menuOpen} onClose={closeMenu} onNavigate={() => setMenuOpen(false)} />
      <div className="lg:pl-64">
        <TopBar menuOpen={menuOpen} onMenuClick={() => setMenuOpen(true)} menuButtonRef={menuButtonRef} />
        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
