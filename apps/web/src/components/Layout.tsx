import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const TOP_NAV = [
  { to: "/accounts", label: "Accounts" },
  { to: "/characters", label: "Characters" },
  { to: "/bans", label: "Bans" },
];

const WORLD_NAV = [
  { to: "/quests", label: "Quests" },
  { to: "/items", label: "Items" },
  { to: "/mobs", label: "Mobs" },
  { to: "/npc-templates", label: "NPC templates" },
  { to: "/loot-templates", label: "Loot templates" },
  { to: "/merchant-lists", label: "Merchant lists" },
  { to: "/spells", label: "Spells" },
  { to: "/styles", label: "Styles" },
  { to: "/regions", label: "Regions" },
  { to: "/zones", label: "Zones" },
  { to: "/teleports", label: "Teleports" },
  { to: "/server-properties", label: "Server config" },
  { to: "/xp-rate", label: "XP rate" },
  { to: "/death-xp-loss", label: "Death XP loss" },
];

const ADMIN_NAV = [
  { to: "/staff", label: "Staff" },
  { to: "/audit", label: "Audit" },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm transition ${
    isActive
      ? "bg-amber-500 font-medium text-slate-900"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
  }`;

export function Layout() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold">OpenDAoC Manager</span>
            <nav className="flex items-center gap-1">
              {TOP_NAV.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClass}>
                  {item.label}
                </NavLink>
              ))}

              {/* World-content dropdown (hover to open). */}
              <div className="group relative">
                <button className="rounded-md px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 group-hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 dark:group-hover:bg-slate-800">
                  World ▾
                </button>
                <div className="absolute left-0 top-full z-10 hidden min-w-44 rounded-md border border-slate-200 bg-white p-1 shadow-lg group-hover:block dark:border-slate-700 dark:bg-slate-900">
                  {WORLD_NAV.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `block rounded px-3 py-1.5 text-sm ${
                          isActive
                            ? "bg-amber-500 font-medium text-slate-900"
                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>

              {isAdmin &&
                ADMIN_NAV.map((item) => (
                  <NavLink key={item.to} to={item.to} className={linkClass}>
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
