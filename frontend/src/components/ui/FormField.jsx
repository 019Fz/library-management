// A label plus an input. With "revealable" a password field gets a show/hide button.
// Optional: "error" shows a message under the field; "inputMode", "list" (datalist id), "placeholder", "required".
import { useId, useState } from "react";
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
  error,
  inputMode,
  list,
  placeholder,
  required = true,
}) {
  const [visible, setVisible] = useState(false);
  const errorId = useId();
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
          inputMode={inputMode}
          list={list}
          placeholder={placeholder}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`block min-h-11 w-full rounded-field border bg-card px-4 py-2 text-base text-ink focus-ring ${
            error ? "border-danger" : "border-edge"
          } ${revealable ? "pr-14" : ""}`}
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
      {error && (
        <p id={errorId} className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
