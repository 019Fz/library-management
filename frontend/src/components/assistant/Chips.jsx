// A row of question chips (examples and suggestions). Clicking one asks that question.
export default function Chips({ items, onPick, disabled = false, label }) {
  if (items.length === 0) return null;

  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item}>
          <button
            type="button"
            onClick={() => onPick(item)}
            disabled={disabled}
            className="min-h-11 rounded-full border border-line bg-card px-3 py-1 text-left text-sm text-ink hover:bg-surface focus-ring disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-9"
          >
            {item}
          </button>
        </li>
      ))}
    </ul>
  );
}
