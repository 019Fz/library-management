// Reading status as a colored badge: reading is blue, completed is green, to-read is slate.
import Badge from "../ui/Badge.jsx";
import { STATUS_LABELS } from "../../lib/format.js";

export default function StatusBadge({ status }) {
  return <Badge tone={status}>{STATUS_LABELS[status] ?? status}</Badge>;
}
