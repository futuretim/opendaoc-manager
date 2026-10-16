import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { itemsApi, REALM_NAMES } from "../lib/api";

export function ItemsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);

  const { data, isFetching, error } = useQuery({
    queryKey: ["items", term, page],
    queryFn: () => itemsApi.search(term, page),
    placeholderData: (prev) => prev,
  });
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Items</h1>
        {isAdmin && (
          <Link
            to="/items/new"
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-amber-400"
          >
            New item
          </Link>
        )}
      </div>

      <input
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setPage(1);
        }}
        placeholder="Search by item name or template id (Id_nb)…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
      />

      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Template id</th>
              <th className="px-4 py-2 font-medium">Level</th>
              <th className="px-4 py-2 font-medium">Realm</th>
              <th className="px-4 py-2 font-medium">Quality</th>
              <th className="px-4 py-2 font-medium">DPS/AF</th>
              <th className="px-4 py-2 font-medium">SPD/ABS</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.idNb} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-2">
                  <Link to={`/items/${encodeURIComponent(it.idNb)}`} className="font-medium text-amber-600 hover:underline">
                    {it.name || it.idNb}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{it.idNb}</td>
                <td className="px-4 py-2">{it.level}</td>
                <td className="px-4 py-2">{REALM_NAMES[it.realm] ?? it.realm}</td>
                <td className="px-4 py-2">{it.quality}%</td>
                <td className="px-4 py-2">{(it.dpsAf / 10).toFixed(1)}</td>
                <td className="px-4 py-2">{(it.spdAbs / 10).toFixed(1)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  {isFetching ? "Loading…" : "No items found."}
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
