// Sidebar links. "roles" lists who can see each link (the backend is still the real check).
export const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard", roles: ["admin"] },
  { to: "/books", label: "Books", icon: "book", roles: ["user", "admin"] },
  { to: "/admin/books", label: "All books", icon: "library", roles: ["admin"] },
  { to: "/users", label: "Users", icon: "users", roles: ["admin"] },
];
