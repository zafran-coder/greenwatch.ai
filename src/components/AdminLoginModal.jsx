import { useState, useEffect, useRef } from "react";
import { ShieldCheck, X, Loader2, Sparkles } from "lucide-react";
import { Btn, inputCls, FieldLabel } from "./ui";

export default function AdminLoginModal({ isOpen, onClose, onLogin }) {
  const [email, setEmail] = useState("admin@greenwatch.gov");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const dialogRef = useRef(null);
  const emailInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      // Focus email input on open
      setTimeout(() => emailInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onLogin({ email: email.trim(), password: password.trim() });
      onClose();
    } catch (err) {
      setError(err.message || "Invalid municipal credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail("admin@greenwatch.gov");
    setError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-login-title"
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl transition-transform animate-in zoom-in-95 duration-200"
      >
        <button
          onClick={onClose}
          disabled={loading}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-green-100 text-green-700">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h2 id="admin-login-title" className="text-base font-semibold text-slate-900">
              City Official Access
            </h2>
            <p className="text-xs text-slate-500">
              Sign in to manage and approve work orders
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div>
            <FieldLabel required>Email address</FieldLabel>
            <input
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@greenwatch.gov"
              autoComplete="username"
              required
              className={inputCls}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <FieldLabel required>Password</FieldLabel>
              <button
                type="button"
                onClick={fillDemo}
                className="text-[11px] font-medium text-green-700 hover:underline"
              >
                Fill demo
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className={inputCls}
            />
          </div>

          <div className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-500 flex items-center justify-between">
            <span>Demo: <strong className="text-slate-700">admin@greenwatch.gov</strong></span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700">
              <Sparkles className="size-3" /> Ready
            </span>
          </div>

          <div className="flex gap-2.5 pt-2">
            <Btn
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Btn>
            <Btn type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}
