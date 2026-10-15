import { useAuth } from "../auth/AuthContext";

const PLANNED = [
  { title: "Accounts", desc: "Search, reset password, privilege/status, mute/warn", milestone: "M2" },
  { title: "Characters", desc: "Search & inspect (read-only)", milestone: "M3" },
  { title: "Bans", desc: "Create / list / lift bans", milestone: "M4" },
  { title: "Server status", desc: "Online players & realm balance (serverstats)", milestone: "M1" },
  { title: "Staff & audit", desc: "Manage staff users, view audit log", milestone: "M4" },
];

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold">OpenDAoC Manager</h1>
        <div className="flex items-center gap-4 text-sm">
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
      </header>

      <main className="mx-auto max-w-4xl p-6">
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <strong>M0 scaffold.</strong> Auth, routing, and the API/DB wiring are in
          place. The modules below are stubs to be built out in later milestones
          (see <code>docs/MVP_SPEC.md</code>).
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PLANNED.map((f) => (
            <div
              key={f.title}
              className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{f.title}</h2>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                  {f.milestone}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
