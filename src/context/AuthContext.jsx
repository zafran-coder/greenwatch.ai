import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import AdminLoginModal from "../components/AdminLoginModal";

const AuthContext = createContext(null);

const STORAGE_KEY = "greenwatch_auth_session";

export function AuthProvider({ children }) {
  const toast = useToast();
  const [role, setRoleState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.role === "official") return "official";
      }
    } catch {}
    return "citizen";
  });

  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.user || null;
      }
    } catch {}
    return null;
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // Background session verification on mount
  useEffect(() => {
    let isCurrent = true;
    api.auth
      .getMe()
      .then((verifiedUser) => {
        if (!isCurrent) return;
        if (verifiedUser) {
          setUser(verifiedUser);
          setRoleState("official");
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ role: "official", user: verifiedUser })
          );
        } else {
          // If server reports no active session, revert official role
          if (role === "official") {
            setRoleState("citizen");
            setUser(null);
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      })
      .catch(() => {
        // If checking auth fails (e.g. 401 or offline), default to citizen
        if (isCurrent && role === "official" && !user) {
          setRoleState("citizen");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const openLoginModal = useCallback((actionCallback = null) => {
    if (actionCallback) {
      setPendingAction(() => actionCallback);
    }
    setIsLoginModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setIsLoginModalOpen(false);
    setPendingAction(null);
  }, []);

  const login = useCallback(
    async (credentials) => {
      const res = await api.auth.login(credentials);
      const token = res?.token || res?.data?.token;
      if (token) {
        localStorage.setItem("greenwatch_auth_token", token);
      }

      const loggedUser = res?.user || res?.data?.user || {
        name: "City Operations Admin",
        email: credentials.email,
        role: "ADMIN",
      };

      setUser(loggedUser);
      setRoleState("official");
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ role: "official", user: loggedUser })
      );

      toast("Signed in as City Official", "info");

      if (pendingAction) {
        try {
          pendingAction();
        } catch (err) {
          console.error("[Auth] Error executing pending action:", err);
        }
        setPendingAction(null);
      }

      return loggedUser;
    },
    [toast, pendingAction]
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch (e) {
      // Continue client cleanup even if network fails
    }
    setUser(null);
    setRoleState("citizen");
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("greenwatch_auth_token");
    toast("Signed out — viewing as Citizen", "info");
  }, [toast]);

  const setRole = useCallback(
    (newRole) => {
      if (newRole === "official") {
        if (user) {
          setRoleState("official");
          toast("Viewing as City Official", "info");
        } else {
          openLoginModal();
        }
      } else {
        setRoleState("citizen");
        toast("Viewing as Citizen", "info");
      }
    },
    [user, openLoginModal, toast]
  );

  const requireOfficial = useCallback(
    (callback) => {
      if (role === "official" && user) {
        return callback();
      }
      toast("Please sign in as a City Official to perform this action", "info");
      openLoginModal(callback);
    },
    [role, user, openLoginModal, toast]
  );

  const value = {
    role,
    user,
    isAuthenticated: Boolean(user && role === "official"),
    isOfficial: role === "official",
    login,
    logout,
    setRole,
    openLoginModal,
    closeLoginModal,
    requireOfficial,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={closeLoginModal}
        onLogin={login}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
