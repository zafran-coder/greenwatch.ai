import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Card, CardHeader, Select, inputCls } from "./ui";
import { AIBadge, PriorityBadge } from "./Badges";
import { useToast } from "./Toast";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
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

export default function WorkOrderCard({ report, onUpdate }) {
  const toast = useToast();
  const { requireOfficial, isOfficial } = useAuth();
  const [officials, setOfficials] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    api.analytics
      .getOfficials()
      .then((res) => {
        if (!isCurrent) return;
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setOfficials(list);
      })
      .catch(() => {});

    return () => {
      isCurrent = false;
    };
  }, []);

  // Filter officials by report department if matches, otherwise show all
  const filteredOfficials = officials.filter((o) => {
    if (!report.department) return true;
    return o.department?.toLowerCase() === report.department?.toLowerCase();
  });

  const displayOfficials = filteredOfficials.length > 0 ? filteredOfficials : officials;

  const assign = (name) => {
    requireOfficial(async () => {
      setSubmitting(true);
      try {
        const assignee = name || null;
        const updated = await api.reports.updateWorkOrder(report.id, {
          assignee,
        });
        toast(assignee ? `Assigned to ${assignee}` : "Work order unassigned");
        onUpdate?.(updated);
      } catch (err) {
        toast(err.message || "Failed to update assignee", "error");
      } finally {
        setSubmitting(false);
      }
    });
  };

  const changeDue = (value) => {
    if (!value) return;
    requireOfficial(async () => {
      setSubmitting(true);
      try {
        const dueDate = new Date(`${value}T17:00:00`).toISOString();
        const updated = await api.reports.updateWorkOrder(report.id, {
          dueDate,
        });
        toast(`Due date updated to ${fmtDate(new Date(dueDate))}`);
        onUpdate?.(updated);
      } catch (err) {
        toast(err.message || "Failed to update due date", "error");
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <Card>
      <CardHeader
        icon={ClipboardList}
        title="Work Order"
        sub="AI suggested · human approved"
        aside={
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            {report.workOrder || report.workOrderRef || "WO-PENDING"}
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
            disabled={submitting}
            className="w-44"
          >
            <option value="">Unassigned</option>
            {displayOfficials.map((o) => (
              <option key={o.id || o.name} value={o.name}>
                {o.name}
              </option>
            ))}
          </Select>
        </Row>
        <Row label="Due date">
          <input
            type="date"
            defaultValue={dateInputValue(report.dueDate || report.slaDueAt)}
            onChange={(e) => changeDue(e.target.value)}
            disabled={submitting}
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
