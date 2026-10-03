// ---------------------------------------------------------------------------
// GreenWatch AI Store
// High-fidelity reactive store with optimistic UI updates and live Supabase / REST sync.
// Reports submitted by citizens appear on the dashboard immediately and persist
// to the backend database & Supabase.
// ---------------------------------------------------------------------------

import { useSyncExternalStore } from "react";
import { reports as seed } from "./mockData";
import { supabase } from "../lib/supabase";

let state = {
  reports: seed.map((r) => ({ ...r })),
  role: "citizen", // "citizen" | "official" — view toggle, no login
};

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const getSnapshot = () => state;

export const useStore = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
export const useReports = () => useStore().reports;
export const useRole = () => useStore().role;

export function setRole(role) {
  state = { ...state, role };
  emit();
}

// --- Live Synchronization with Backend & Supabase -----------------------------

export async function syncFromBackend() {
  try {
    const res = await fetch("/api/reports?take=100");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        state = { ...state, reports: data.items };
        emit();
      }
    }
  } catch (err) {
    // Graceful offline fallback to in-memory state
  }
}

// Initial background sync
if (typeof window !== "undefined") {
  syncFromBackend();

  // Supabase real-time subscription for live municipal updates
  if (supabase) {
    try {
      supabase
        .channel("greenwatch-reports")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "reports" },
          () => {
            syncFromBackend();
          }
        )
        .subscribe();
    } catch (e) {
      // Real-time channel fallback
    }
  }
}

// --- Reads ------------------------------------------------------------------

export const getReportById = (id) => state.reports.find((r) => r.id === id);

export const getReportByRef = (ref) =>
  state.reports.find(
    (r) => r.ref.toLowerCase() === String(ref || "").trim().toLowerCase()
  );

// --- Writes -----------------------------------------------------------------

export function addReport(report) {
  // 1. Optimistic instant UI update
  state = { ...state, reports: [report, ...state.reports] };
  emit();

  // 2. Persist to Backend API / Supabase
  fetch("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: report.category,
      description: report.description,
      location: report.location,
      photos: report.photos || [],
      priority: report.priority,
      status: report.status,
      department: report.department,
      assignee: report.assignee,
      ai: report.ai,
      activity: report.activity,
      workOrder: report.workOrder,
    }),
  })
    .then(async (res) => {
      if (res.ok) {
        const saved = await res.json();
        // Update item with backend ID / server fields if provided
        if (saved && saved.id) {
          state = {
            ...state,
            reports: state.reports.map((r) =>
              r.ref === report.ref || r.id === report.id ? { ...r, ...saved } : r
            ),
          };
          emit();
        }
      }
    })
    .catch((err) => {
      console.warn("[Store] Report sync deferred to local session:", err.message);
    });
}

/**
 * Patch a report and optionally append an activity entry.
 * patch: object merged into the report. entry: { kind, who, text }
 */
export function patchReport(id, patch, entry) {
  const now = new Date().toISOString();

  // 1. Optimistic instant UI update
  state = {
    ...state,
    reports: state.reports.map((r) =>
      r.id === id
        ? {
            ...r,
            ...patch,
            updatedAt: now,
            activity: entry
              ? [...(r.activity || []), { ...entry, at: now }]
              : r.activity,
          }
        : r
    ),
  };
  emit();

  // 2. Persist to Backend API / Supabase
  fetch(`/api/reports/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...patch,
      activityEntry: entry,
    }),
  }).catch((err) => {
    console.warn("[Store] Patch sync deferred to local session:", err.message);
  });
}

export function appendActivity(id, entry) {
  patchReport(id, {}, entry);
}

// --- ID generators ------------------------------------------------------------

export function nextRef() {
  const max = state.reports.reduce(
    (m, r) => Math.max(m, parseInt(String(r.ref || "").replace(/\D/g, ""), 10) || 0),
    0
  );
  return `GW-${max + 1}`;
}

export function nextWorkOrder() {
  const max = state.reports.reduce(
    (m, r) => Math.max(m, parseInt(String(r.workOrder || "").replace(/\D/g, ""), 10) || 0),
    1180
  );
  return `WO-${max + 1}`;
}

export function newId() {
  return `r${Date.now().toString(36)}`;
}
