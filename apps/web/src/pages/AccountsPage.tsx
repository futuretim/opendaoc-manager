import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { accountsApi, PRIV_LEVEL_NAMES, REALM_NAMES } from "../lib/api";

export function AccountsPage() {
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);

  const { data, isFetching, error } = useQuery({
    queryKey: ["accounts", term, page],
    queryFn: () => accountsApi.search(term, page),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Accounts</h1>

      <div className="flex gap-2">
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name or Discord ID…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
        />
      </div>

      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Priv</th>
              <th className="px-4 py-2 font-medium">Realm</th>
              <th className="px-4 py-2 font-medium">Last login</th>
              <th className="px-4 py-2 font-medium">Discord ID</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.name} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-2">
                  <Link to={`/accounts/${encodeURIComponent(a.name)}`} className="font-medium text-amber-600 hover:underline">
                    {a.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{PRIV_LEVEL_NAMES[a.privLevel] ?? a.privLevel}</td>
                <td className="px-4 py-2">{REALM_NAMES[a.realm] ?? a.realm}</td>
                <td className="px-4 py-2 text-slate-500">{a.lastLogin ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500">{a.discordId ?? "—"}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  {isFetching ? "Loading…" : "No accounts found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
        >
          Previous
        </button>
        <span className="text-slate-500">Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={items.length < 25}
          className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
        >
          Next
        </button>
      </div>
    </div>
  );
}
