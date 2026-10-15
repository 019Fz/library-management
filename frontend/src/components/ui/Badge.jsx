// Small colored label, e.g. a book status or a user role.
const TONES = {
  reading: "bg-reading-soft text-reading",
  completed: "bg-completed-soft text-completed",
  "to-read": "bg-to-read-soft text-to-read",
  accent: "bg-accent-soft text-ink",
  neutral: "bg-surface text-muted",
};

export default function Badge({ tone = "neutral", className = "", children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
