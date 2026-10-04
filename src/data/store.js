/**
 * GreenWatch AI Store
 * NOTE: In-memory store has been decommissioned and replaced by direct API client calls (src/api).
 * This module is kept as a thin compatibility shim.
 */

import { api } from "../api";

export const getReportById = (id) => api.reports.getById(id);
export const getReportByRef = (ref) => api.reports.track(ref);
export const addReport = (report) => api.reports.create(report);
export const patchReport = (id, patch) => api.reports.patch(id, patch);
export const appendActivity = (id, entry) => api.reports.addActivity(id, entry);
