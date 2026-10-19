// Sort dropdown. The value is "<sort>:<order>", for example "price:asc".
// options = [{ value, label }]; the books options are the default.
import { useId } from "react";
import { SORT_OPTIONS } from "../../lib/bookQuery.js";

export default function SortSelect({ value, onChange, options = SORT_OPTIONS }) {
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium text-muted">
        Sort by
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-field border border-edge bg-card px-3 text-base text-ink focus-ring"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
