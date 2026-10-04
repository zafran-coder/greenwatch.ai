import { useEffect, useState } from "react";
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
import { CATEGORIES } from "../data/mockData";
import { api } from "../api";
import { ChartSkeleton } from "./Skeletons";

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

/** Reports by category — bar chart (live from GET /api/analytics/categories). */
export function CategoryChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    api.analytics
      .getCategories()
      .then((res) => {
        if (!isCurrent) return;
        const counts = res?.data || res || {};
        const formatted = Object.keys(CATEGORIES).map((key) => ({
          name: SHORT[key] || key,
          count: typeof counts[key] === "number" ? counts[key] : 0,
        }));
        setData(formatted);
        setLoading(false);
      })
      .catch(() => {
        if (!isCurrent) return;
        setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  if (loading) return <ChartSkeleton height={230} />;

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

/** Reports over the last 14 days — line chart (live from GET /api/analytics/trend). */
export function TrendChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    api.analytics
      .getTrends()
      .then((res) => {
        if (!isCurrent) return;
        const trends = res?.data || res || [];
        setData(trends);
        setLoading(false);
      })
      .catch(() => {
        if (!isCurrent) return;
        setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  if (loading) return <ChartSkeleton height={230} />;

  return (
    <ResponsiveContainer width="100%" height={230}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
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

/** Resolution rate by department — horizontal bars (live from GET /api/analytics/departments). */
export function DeptRateChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    api.analytics
      .getDepartments()
      .then((res) => {
        if (!isCurrent) return;
        const depts = res?.data || res || [];
        setData(depts);
        setLoading(false);
      })
      .catch(() => {
        if (!isCurrent) return;
        setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  if (loading) return <ChartSkeleton height={230} />;

  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart
        data={data}
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
