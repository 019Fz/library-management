// "Needs attention": links to the users that need a look. Shown only when a number is above 0
// (so nothing is rendered while loading or when all is well).
//   attention = { usersWithoutBooks, newUsersLast48h } or null
import { Link } from "react-router-dom";
import { attentionItems } from "../../lib/dashboard.js";

export default function AttentionStrip({ attention }) {
  const items = attentionItems(attention);
  if (items.length === 0) return null;

  return (
    <section
      aria-label="Needs attention"
      className="flex flex-col gap-x-6 rounded-card border border-accent bg-accent-soft px-6 py-2 sm:flex-row sm:flex-wrap sm:items-center"
    >
      <h2 className="min-h-11 content-center font-semibold text-ink">Needs attention</h2>
      <ul className="flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-6">
        {items.map((item) => (
          <li key={item.key}>
            <Link to={item.to} className="inline-flex min-h-11 items-center text-ink underline focus-ring">
              {item.text}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
