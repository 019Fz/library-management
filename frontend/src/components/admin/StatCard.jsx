// One number on the dashboard. The whole card is a link when "to" is given.
//   icon  = Icon name, label = what it counts
//   value = the number, or null while loading (a skeleton of the same size is shown)
//   note  = small line under the label, or null while it is not known yet (also a skeleton)
//   badge = short text (for example "+6 this week") shown in place of the note when it is not empty
//   to    = where the card leads
// The label and note lines are always there, so the card keeps its size when the data arrives.
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import Icon from "../ui/Icon.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import { Link } from "react-router-dom";

export default function StatCard({ icon, label, value, note, badge = null, to }) {
  return (
    <Card as={Link} to={to} className="flex min-h-11 items-center gap-4 hover:bg-surface focus-ring">
      <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-field bg-accent-soft text-ink">
        <Icon name={icon} className="h-7 w-7" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="h-9">
          {value === null ? <Skeleton className="h-8 w-24" /> : <p className="truncate text-3xl font-bold leading-9 text-ink">{value}</p>}
        </div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <div className="flex h-5 items-center text-sm text-muted">
          {value === null ? <Skeleton className="h-4 w-28" /> : badge ? <Badge tone="accent">{badge}</Badge> : <span className="truncate">{note}</span>}
        </div>
      </div>
    </Card>
  );
}
