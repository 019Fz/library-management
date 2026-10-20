// One assistant answer: the summary sentence, how the question was understood, then the result.
import Badge from "../ui/Badge.jsx";
import Chips from "./Chips.jsx";
import AnswerTable from "./AnswerTable.jsx";
import { describeIntent, formatCell, sourceLabel } from "../../lib/assistant.js";

export default function AnswerCard({ reply, expanded, busy, onAsk }) {
  const answer = reply.answer ?? {};
  const understood = reply.understood ?? {};
  const suggestions = Array.isArray(answer.suggestions) ? answer.suggestions : [];

  return (
    <div className="rounded-card border border-line bg-card p-3 text-sm text-ink">
      <p className="break-words">{answer.summary}</p>

      {answer.type === "number" && (
        <div className="mt-3">
          <p className="text-3xl font-bold tabular-nums">
            {formatCell(answer.value, answer.format === "price" ? "price" : "number")}
          </p>
          <p className="text-xs text-muted">{answer.title}</p>
        </div>
      )}

      {answer.type === "table" && <AnswerTable answer={answer} expanded={expanded} />}

      {answer.type === "message" && suggestions.length > 0 && (
        <div className="mt-3">
          <Chips items={suggestions} onPick={onAsk} disabled={busy} label="Suggested questions" />
        </div>
      )}

      {understood.intent && understood.intent !== "unsupported" && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Understood as: {describeIntent(understood.intent, understood.params)}</span>
          <Badge>{sourceLabel(understood.source)}</Badge>
        </p>
      )}
    </div>
  );
}
