// Genre and status filters. On large screens it is always visible;
// on phones it is a "Filters" section that opens and closes.
import { useId, useState } from "react";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import { STATUS_LABELS } from "../../lib/format.js";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

// One radio button with its label. Native radios give keyboard support (arrow keys) for free.
function RadioOption({ name, value, label, checked, onChange }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-field px-3 text-sm text-ink hover:bg-surface">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="h-4 w-4 shrink-0 accent-ink focus-ring"
      />
      <span className="min-w-0 break-words">{label}</span>
    </label>
  );
}

// genres: list of names, or null while loading. genresFailed: the list could not be loaded.
export default function FilterPanel({ genres, genresFailed, genre, status, onGenreChange, onStatusChange, onClear }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const activeCount = (genre ? 1 : 0) + (status ? 1 : 0);

  // A genre typed into the URL may not be in the list: show it anyway so the filter is visible
  const genreOptions = genres ? [...genres] : [];
  if (genre && !genreOptions.some((name) => name.toLowerCase() === genre.toLowerCase())) {
    genreOptions.push(genre);
  }

  return (
    <div className="lg:sticky lg:top-24">
      <Button
        variant="outlined"
        fullWidth
        className="lg:hidden"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        Filters{activeCount > 0 ? ` (${activeCount})` : ""}
      </Button>

      <Card id={panelId} className={`${open ? "block" : "hidden"} mt-2 p-4 lg:mt-0 lg:block`}>
        <fieldset className="min-w-0">
          <legend className="text-sm font-semibold text-ink">Genre</legend>
          <div className="mt-1 max-h-56 overflow-y-auto">
            <RadioOption name="genre" value="" label="All genres" checked={!genre} onChange={onGenreChange} />
            {genres === null && !genresFailed && <Skeleton className="mx-3 mt-2 h-5 w-2/3" />}
            {genresFailed && <p className="px-3 py-2 text-sm text-muted">Genres could not be loaded.</p>}
            {genreOptions.map((name) => (
              <RadioOption
                key={name}
                name="genre"
                value={name}
                label={name}
                checked={name.toLowerCase() === genre.toLowerCase()}
                onChange={onGenreChange}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4 min-w-0">
          <legend className="text-sm font-semibold text-ink">Status</legend>
          <div className="mt-1">
            {STATUS_OPTIONS.map((option) => (
              <RadioOption
                key={option.value || "all"}
                name="status"
                value={option.value}
                label={option.label}
                checked={status === option.value}
                onChange={onStatusChange}
              />
            ))}
          </div>
        </fieldset>

        {activeCount > 0 && (
          <Button variant="outlined" size="sm" className="mt-4" onClick={onClear}>
            Clear filters
          </Button>
        )}
      </Card>
    </div>
  );
}
