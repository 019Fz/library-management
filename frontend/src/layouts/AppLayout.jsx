// Layout for logged-in pages: dark sidebar, top bar and the page content.
import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import TopBar from "../components/TopBar.jsx";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import AssistantWidget from "../components/assistant/AssistantWidget.jsx";
import { AssistantProvider } from "../context/AssistantProvider.jsx";

export default function AppLayout() {
  // Only the path (not the ?search part) is used as the boundary's key: moving to another page clears a
  // page error, but changing a filter must not remount the page (it would take the focus out of the search box)
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  // The top-bar slot element; pages reach it through the Outlet context (see TopBarActions)
  const [actionsSlot, setActionsSlot] = useState(null);

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
        <TopBar
          menuOpen={menuOpen}
          onMenuClick={() => setMenuOpen(true)}
          menuButtonRef={menuButtonRef}
          actionsRef={setActionsSlot}
        />
        <main className="p-4 sm:p-6">
          <ErrorBoundary key={pathname}>
            <Outlet context={{ actionsSlot }} />
          </ErrorBoundary>
        </main>
      </div>
      {/* Mounted once here, so the conversation survives page changes and ends on logout */}
      <AssistantProvider>
        <AssistantWidget hidden={menuOpen} />
      </AssistantProvider>
    </div>
  );
}
