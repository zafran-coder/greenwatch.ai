/**
 * GreenWatch AI — API Endpoints Service
 * Standardized endpoint implementations conforming to docs/api-contract.md
 */

import { apiClient } from "./client.js";

export * from "./client.js";
export * from "./hooks.js";

export const api = {
  // --- Auth / Admin Endpoints -----------------------------------------------
  auth: {
    login: async (credentials, options = {}) => {
      const res = await apiClient("/api/admin/login", {
        method: "POST",
        body: credentials,
        ...options,
      });
      return res?.data || res;
    },

    logout: async (options = {}) => {
      const res = await apiClient("/api/admin/logout", {
        method: "POST",
        ...options,
      });
      return res;
    },

    getMe: async (options = {}) => {
      const res = await apiClient("/api/admin/me", {
        method: "GET",
        ...options,
      });
      return res?.data?.user || res?.user || null;
    },
  },

  // --- Reports Endpoints -----------------------------------------------------
  reports: {
    list: async (filters = {}, options = {}) => {
      const queryParams = new URLSearchParams();

      if (filters.status && filters.status !== "All") {
        queryParams.set("status", filters.status);
      }
      if (filters.category && filters.category !== "All") {
        queryParams.set("category", filters.category);
      }
      if (filters.priority && filters.priority !== "All") {
        queryParams.set("priority", filters.priority);
      }
      if (filters.department && filters.department !== "All") {
        queryParams.set("department", filters.department);
      }
      if (filters.q && filters.q.trim()) {
        queryParams.set("q", filters.q.trim());
      }
      if (filters.sortBy) {
        queryParams.set("sortBy", filters.sortBy);
      }
      if (filters.sortOrder) {
        queryParams.set("sortOrder", filters.sortOrder);
      }
      if (filters.page) {
        queryParams.set("page", String(filters.page));
      }
      if (filters.limit) {
        queryParams.set("limit", String(filters.limit));
      }

      const qs = queryParams.toString();
      const endpoint = qs ? `/api/reports?${qs}` : "/api/reports";
      const res = await apiClient(endpoint, {
        method: "GET",
        ...options,
      });

      const items = res?.data || res?.items || [];
      const total = res?.total !== undefined ? res.total : items.length;
      return {
        items,
        data: items,
        total,
        page: res?.page || 1,
        limit: res?.limit || 50,
        totalPages: res?.totalPages || 1,
      };
    },

    getById: async (idOrRef, options = {}) => {
      const res = await apiClient(`/api/reports/${encodeURIComponent(idOrRef)}`, {
        method: "GET",
        ...options,
      });
      return res?.data || res;
    },

    track: async (ref, options = {}) => {
      try {
        const res = await apiClient(`/api/track/${encodeURIComponent(ref)}`, {
          method: "GET",
          ...options,
        });
        return res?.data || res;
      } catch (err) {
        // Fallback to /api/reports/:ref if /api/track/:ref returns 404
        if (err.status === 404) {
          const fallback = await apiClient(`/api/reports/${encodeURIComponent(ref)}`, {
            method: "GET",
            ...options,
          });
          return fallback?.data || fallback;
        }
        throw err;
      }
    },

    create: async (data, options = {}) => {
      // Accepts FormData (with attached photos) or JSON object
      const res = await apiClient("/api/reports", {
        method: "POST",
        body: data,
        ...options,
      });
      return {
        report: res?.data || res?.report || res,
        photos: res?.photos || [],
        steps: res?.steps || [],
      };
    },

    getPipeline: async (idOrRef, options = {}) => {
      const res = await apiClient(`/api/reports/${encodeURIComponent(idOrRef)}/pipeline`, {
        method: "GET",
        ...options,
      });
      return res?.data || res;
    },

    patch: async (id, patch, options = {}) => {
      const res = await apiClient(`/api/reports/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: patch,
        ...options,
      });
      return res?.data || res;
    },

    updateStatus: async (id, status, note, options = {}) => {
      const res = await apiClient(`/api/reports/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: { status, note },
        ...options,
      });
      return res?.data || res;
    },

    updateWorkOrder: async (id, workOrderPatch, options = {}) => {
      const res = await apiClient(`/api/reports/${encodeURIComponent(id)}/work-order`, {
        method: "PATCH",
        body: workOrderPatch,
        ...options,
      });
      return res?.data || res;
    },

    addActivity: async (id, activityEntry, options = {}) => {
      const res = await apiClient(`/api/reports/${encodeURIComponent(id)}/activity`, {
        method: "POST",
        body: activityEntry,
        ...options,
      });
      return res?.data || res;
    },

    triggerFollowUp: async (id, options = {}) => {
      const res = await apiClient(`/api/reports/${encodeURIComponent(id)}/follow-up`, {
        method: "POST",
        ...options,
      });
      return res?.data || res;
    },

    overrideAi: async (id, overrides, options = {}) => {
      const res = await apiClient(`/api/reports/${encodeURIComponent(id)}/ai-decision`, {
        method: "PATCH",
        body: overrides,
        ...options,
      });
      return res?.data || res;
    },
  },

  // --- Dashboard & Analytics Endpoints ---------------------------------------
  analytics: {
    getKpis: async (options = {}) => {
      const res = await apiClient("/api/dashboard/kpis", {
        method: "GET",
        ...options,
      });
      return res?.data || res;
    },

    getAttention: async (options = {}) => {
      try {
        const res = await apiClient("/api/dashboard/attention", {
          method: "GET",
          ...options,
        });
        return res?.data || res || [];
      } catch {
        return [];
      }
    },

    getCategories: async (options = {}) => {
      const res = await apiClient("/api/analytics/categories", {
        method: "GET",
        ...options,
      });
      return res?.data || res;
    },

    getTrends: async (options = {}) => {
      const res = await apiClient("/api/analytics/trend", {
        method: "GET",
        ...options,
      });
      return res?.data || res || [];
    },

    getDepartments: async (options = {}) => {
      const res = await apiClient("/api/analytics/departments", {
        method: "GET",
        ...options,
      });
      return res?.data || res || [];
    },

    getOfficials: async (options = {}) => {
      const res = await apiClient("/api/officials", {
        method: "GET",
        ...options,
      });
      return res?.data || res || [];
    },
  },
};
