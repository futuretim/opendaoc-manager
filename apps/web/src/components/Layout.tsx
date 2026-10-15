import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV = [
  { to: "/accounts", label: "Accounts" },
  { to: "/characters", label: "Characters" },
  { to: "/quests", label: "Quests" },
  { to: "/items", label: "Items" },
  { to: "/mobs", label: "Mobs" },
  { to: "/npc-templates", label: "Templates" },
  { to: "/bans", label: "Bans" },
];

const ADMIN_NAV = [
  { to: "/staff", label: "Staff" },
  { to: "/audit", label: "Audit" },
];

export function Layout() {
  const { user, logout } = useAuth();
  const nav = user?.role === "admin" ? [...NAV, ...ADMIN_NAV] : NAV;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold">OpenDAoC Manager</span>
            <nav className="flex gap-1">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm transition ${
                      isActive
                        ? "bg-amber-500 font-medium text-slate-900"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">
              {user?.email} · <span className="uppercase">{user?.role}</span>
            </span>
            <button
              onClick={() => void logout()}
              className="rounded-md border border-slate-300 px-3 py-1.5 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        <Outlet />
      </main>
    </div>
  );
}
