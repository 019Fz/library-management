// Sort dropdown. The value is "<sort>:<order>", for example "price:asc".
import { SORT_OPTIONS } from "../../lib/bookQuery.js";

export default function SortSelect({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="book-sort" className="text-sm font-medium text-muted">
        Sort by
      </label>
      <select
        id="book-sort"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-field border border-edge bg-card px-3 text-base text-ink focus-ring"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
