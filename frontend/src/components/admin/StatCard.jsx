// One number on the dashboard.
//   icon  = Icon name, label = what it counts
//   value = the number, or null while loading (a skeleton of the same size is shown)
//   note  = small line under the label, or null while it is not known yet (also a skeleton)
// The label and note lines are always there, so the card keeps its size when the data arrives.
import Card from "../ui/Card.jsx";
import Icon from "../ui/Icon.jsx";
import Skeleton from "../ui/Skeleton.jsx";

export default function StatCard({ icon, label, value, note }) {
  return (
    <Card className="flex items-center gap-4">
      <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-field bg-accent-soft text-ink">
        <Icon name={icon} className="h-7 w-7" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="h-9">
          {value === null ? <Skeleton className="h-8 w-24" /> : <p className="truncate text-3xl font-bold leading-9 text-ink">{value}</p>}
        </div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <div className="h-5 text-sm text-muted">{note ?? <Skeleton className="mt-0.5 h-4 w-28" />}</div>
      </div>
    </Card>
  );
}
