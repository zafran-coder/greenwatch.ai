import { ClipboardList } from "lucide-react";
import { Card, CardHeader, Select, inputCls } from "./ui";
import { AIBadge, PriorityBadge } from "./Badges";
import { OFFICIALS } from "../data/mockData";
import { patchReport } from "../data/store";
import { useToast } from "./Toast";
import { dateInputValue, fmtDate } from "../utils/format";

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-slate-900">
        {children}
      </span>
    </div>
  );
}

export default function WorkOrderCard({ report }) {
  const toast = useToast();

  const assign = (name) => {
    const assignee = name || null;
    patchReport(
      report.id,
      {
        assignee,
        status:
          report.status === "New" || report.status === "Verified"
            ? "Assigned"
            : report.status,
      },
      {
        kind: "human",
        who: "You (Official)",
        text: assignee
          ? `Assigned the work order to ${assignee}.`
          : "Unassigned the work order.",
      }
    );
    toast(assignee ? `Assigned to ${assignee}` : "Work order unassigned");
  };

  const changeDue = (value) => {
    if (!value) return;
    patchReport(
      report.id,
      { dueDate: new Date(`${value}T17:00:00`).toISOString() },
      {
        kind: "human",
        who: "You (Official)",
        text: `Due date changed to ${fmtDate(new Date(`${value}T17:00:00`))}.`,
      }
    );
    toast("Due date updated");
  };

  return (
    <Card>
      <CardHeader
        icon={ClipboardList}
        title="Work Order"
        sub="AI suggested · human approved"
        aside={
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            {report.workOrder}
          </span>
        }
      />
      <div className="divide-y divide-slate-50 px-5 py-2">
        <Row label="Department">{report.department}</Row>
        <Row label="Priority">
          <PriorityBadge value={report.priority} />
        </Row>
        <Row label="Assigned official">
          <Select
            value={report.assignee || ""}
            onChange={(e) => assign(e.target.value)}
            className="w-44"
          >
            <option value="">Unassigned</option>
            {(OFFICIALS[report.department] || []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        </Row>
        <Row label="Due date">
          <input
            type="date"
            defaultValue={dateInputValue(report.dueDate)}
            onChange={(e) => changeDue(e.target.value)}
            className={`${inputCls} w-44 py-1.5!`}
          />
        </Row>
      </div>
      <div className="flex items-center gap-1.5 border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
        <AIBadge />
        Routed by the Priority Agent — reassignment stays human.
      </div>
    </Card>
  );
}
