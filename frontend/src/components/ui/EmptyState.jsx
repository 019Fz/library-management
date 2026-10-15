// Centered message for pages or lists with nothing to show. "icon" is an Icon name; "action" is optional.
import Icon from "./Icon.jsx";

export default function EmptyState({ icon = "book", title, text, action }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-ink">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
      {text && <p className="mt-1 max-w-sm text-muted">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
