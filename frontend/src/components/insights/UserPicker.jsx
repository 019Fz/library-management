// Admin only: find a user by name or email and choose one. A search box plus a short list of buttons
// (a select would miss users, because the users API returns at most 50 at a time).
//   selectedId = the user shown now, or null
//   onSelect   = called with (id, name) when a user is chosen
// The search text is local state (not in the URL). With no text, the first 8 users A-Z are listed.
import { useState } from "react";
import { useList } from "../../lib/useBooks.js";
import SearchBox from "../books/SearchBox.jsx";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import ErrorBox from "../ui/ErrorBox.jsx";
import Skeleton from "../ui/Skeleton.jsx";

const RESULTS = 8;

export default function UserPicker({ selectedId, onSelect }) {
  const [text, setText] = useState("");

  // URLSearchParams encodes the text, so any characters in a name or email are safe
  const query = new URLSearchParams({ sort: "name", order: "asc", limit: String(RESULTS) });
  if (text.trim()) query.set("q", text.trim());
  const { loading, error, data, retry } = useList("/api/admin/users", query.toString());

  let results;
  if (error) {
    results = (
      <div className="mt-3 space-y-3">
        <ErrorBox message={error.message} details={error.details} />
        <Button variant="outlined" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  } else if (loading) {
    results = (
      <ul aria-hidden="true" className="mt-3 divide-y divide-line">
        {[0, 1, 2].map((index) => (
          <li key={index} className="py-3">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="mt-2 h-4 w-1/3" />
          </li>
        ))}
      </ul>
    );
  } else if (data.users.length === 0) {
    results = <p className="mt-3 text-muted">No users match.</p>;
  } else {
    results = (
      <ul aria-label="Users" className="mt-3 divide-y divide-line">
        {data.users.map((user) => (
          <li key={user.id}>
            <button
              type="button"
              onClick={() => onSelect(user.id, user.name)}
              aria-current={user.id === selectedId ? "true" : undefined}
              className={`flex min-h-11 w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-surface focus-ring sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${
                user.id === selectedId ? "bg-accent-soft" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-semibold text-ink">
                  <span className="truncate">{user.name}</span>
                  {user.role === "admin" && <Badge tone="accent">Admin</Badge>}
                </span>
                <span className="block truncate text-sm text-muted">{user.email}</span>
              </span>
              <span className="shrink-0 text-sm text-muted">
                {user.booksCount} {user.booksCount === 1 ? "book" : "books"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink">Choose a user</h2>
      <div className="mt-3">
        <SearchBox
          value={text}
          onSearch={setText}
          label="Search users by name or email"
          placeholder="Search name or email"
        />
      </div>
      {results}
    </Card>
  );
}
