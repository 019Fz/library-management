// The rows of a table answer. Narrow panel: each row is a small card of label/value pairs.
// Expanded panel (from "sm" up): a real table. Only the rows received are shown.
import StatusBadge from "../books/StatusBadge.jsx";
import { formatCell } from "../../lib/assistant.js";
import { STATUS_LABELS } from "../../lib/format.js";

// Status cells get the colored badge; everything else is plain text
function Cell({ value, type }) {
  if (type === "status" && Object.hasOwn(STATUS_LABELS, value)) return <StatusBadge status={value} />;
  return formatCell(value, type);
}

export default function AnswerTable({ answer, expanded }) {
  const columns = Array.isArray(answer.columns) ? answer.columns : [];
  const rows = Array.isArray(answer.rows) ? answer.rows : [];
  if (columns.length === 0 || rows.length === 0) return null;

  return (
    <>
      <ul aria-label={answer.title} className={`mt-3 space-y-2 ${expanded ? "sm:hidden" : ""}`}>
        {rows.map((row, index) => (
          <li key={index} className="rounded-field bg-surface p-2.5">
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-sm">
              {columns.map((column) => (
                <div key={column.key} className="contents">
                  <dt className="text-xs text-muted">{column.label}</dt>
                  <dd className="min-w-0 break-words text-ink">
                    <Cell value={row[column.key]} type={column.type} />
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      {expanded && (
        <div className="mt-3 hidden overflow-x-auto sm:block">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">{answer.title}</caption>
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`px-2 py-1.5 font-medium ${column.type === "number" || column.type === "price" ? "text-right" : ""}`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b border-line last:border-0">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-2 py-1.5 text-ink ${column.type === "number" || column.type === "price" ? "text-right tabular-nums" : ""}`}
                    >
                      <Cell value={row[column.key]} type={column.type} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
