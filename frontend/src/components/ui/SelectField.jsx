// A label plus a native select. options: [{ value, label }]
export default function SelectField({ id, label, value, onChange, options }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block min-h-11 w-full rounded-field border border-edge bg-card px-3 py-2 text-base text-ink focus-ring"
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
