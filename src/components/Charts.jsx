import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from "recharts";
import { CATEGORIES, trend14, deptRates } from "../data/mockData";
import { useReports } from "../data/store";

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #E2E8F0",
  background: "#fff",
  boxShadow: "0 8px 24px -12px rgb(15 23 42 / 0.25)",
  fontSize: 12,
  padding: "8px 12px",
};

const AXIS_TICK = { fontSize: 11, fill: "#94A3B8" };

const SHORT = {
  garbage: "Garbage",
  tree: "Trees",
  water: "Water",
  plants: "Plants",
  park: "Parks",
  blocked: "Blocked",
};

/** Reports by category — bar chart (live from the store). */
export function CategoryChart() {
  const reports = useReports();
  const data = Object.keys(CATEGORIES).map((key) => ({
    name: SHORT[key],
    count: reports.filter((r) => r.category === key).length,
  }));

  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#EDF2F0" />
        <XAxis
          dataKey="name"
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          dy={6}
        />
        <YAxis
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "rgba(15,23,42,0.04)" }}
          formatter={(v) => [`${v} reports`, "Filed"]}
        />
        <Bar dataKey="count" fill="#16A34A" radius={[6, 6, 0, 0]} barSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Reports over the last 14 days — line chart. */
export function TrendChart() {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <LineChart data={trend14} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#EDF2F0" />
        <XAxis
          dataKey="day"
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          dy={6}
          minTickGap={28}
        />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "#CBD5E1" }} />
        <Line
          type="monotone"
          dataKey="filed"
          name="Filed"
          stroke="#16A34A"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="resolved"
          name="Resolved"
          stroke="#94A3B8"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Resolution rate by department — horizontal bars. */
export function DeptRateChart() {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart
        data={deptRates}
        layout="vertical"
        margin={{ top: 4, right: 40, left: 0, bottom: 0 }}
      >
        <CartesianGrid horizontal={false} stroke="#EDF2F0" />
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="name"
          width={112}
          tick={{ fontSize: 11, fill: "#64748B" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "rgba(15,23,42,0.04)" }}
          formatter={(v) => [`${v}% resolved`, "Resolution rate"]}
        />
        <Bar dataKey="rate" fill="#16A34A" radius={[0, 6, 6, 0]} barSize={18}>
          <LabelList
            dataKey="rate"
            position="right"
            formatter={(v) => `${v}%`}
            style={{ fontSize: 11, fill: "#475569", fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
