import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Sprout, Menu, X, User, ShieldCheck, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const LINKS = [
  { to: "/report", label: "Report" },
  { to: "/track", label: "Track" },
  { to: "/dashboard", label: "Dashboard" },
];

function RoleToggle() {
  const { role, setRole } = useAuth();

  return (
    <div className="flex h-9 items-center gap-1 rounded-full bg-slate-100 p-1">
      {[
        { id: "citizen", label: "Citizen", icon: User },
        { id: "official", label: "Official", icon: ShieldCheck },
      ].map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setRole(id)}
          aria-pressed={role === id}
          className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-all sm:px-3 ${
            role === id
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Icon className="size-3.5" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated, role, logout } = useAuth();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="group flex items-center gap-2.5 outline-none">
          <span className="inline-flex size-8 items-center justify-center rounded-[10px] bg-green-600 text-white transition-transform group-hover:scale-105">
            <Sprout className="size-[18px]" />
          </span>
          <span className="text-[17px] font-bold tracking-tight text-slate-900">
            GreenWatch <span className="text-green-600">AI</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-green-50 text-green-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* Role toggle: desktop only — lives in the hamburger menu on mobile */}
          <div className="hidden items-center gap-2 md:flex">
            <RoleToggle />
            {role === "official" && isAuthenticated && (
              <button
                onClick={logout}
                title="Log out from official mode"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              >
                <LogOut className="size-3.5 text-slate-500" />
                <span>Log out</span>
              </button>
            )}
          </div>

          <button
            className="inline-flex size-9 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 bg-white px-4 pb-4 pt-2 shadow-pop md:hidden">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `mt-1 block rounded-xl px-3.5 py-2.5 text-sm font-medium ${
                  isActive
                    ? "bg-green-50 text-green-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs font-medium text-slate-500">Viewing as</span>
            <div className="flex items-center gap-2">
              <RoleToggle />
              {role === "official" && isAuthenticated && (
                <button
                  onClick={logout}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600"
                >
                  <LogOut className="size-3 text-slate-500" />
                  <span>Log out</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
