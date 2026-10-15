// A label plus an input. With "revealable" a password field gets a show/hide button.
import { useState } from "react";
import Icon from "./Icon.jsx";

export default function FormField({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  maxLength,
  revealable = false,
}) {
  const [visible, setVisible] = useState(false);
  const inputType = revealable && visible ? "text" : type;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          name={id}
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          maxLength={maxLength}
          required
          className={`block min-h-11 w-full rounded-field border border-edge bg-card px-4 py-2 text-base text-ink focus-ring ${
            revealable ? "pr-14" : ""
          }`}
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-pressed={visible}
            aria-label="Show password"
            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink focus-ring"
          >
            <Icon name={visible ? "eye-off" : "eye"} />
          </button>
        )}
      </div>
    </div>
  );
}
