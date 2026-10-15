import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { REALM_NAMES, teleportsApi } from "../lib/api";

export function TeleportsPage() {
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);

  const { data, isFetching, error } = useQuery({
    queryKey: ["teleports", term, page],
    queryFn: () => teleportsApi.search(term, page),
    placeholderData: (prev) => prev,
  });
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Teleports</h1>

      <input
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setPage(1);
        }}
        placeholder="Search by teleport id or type…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
      />

      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">Teleport id</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Realm</th>
              <th className="px-4 py-2 font-medium">Region</th>
              <th className="px-4 py-2 font-medium">Destination (x, y, z · heading)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t, i) => (
              <tr key={`${t.teleportID}-${t.realm}-${i}`} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-2 font-mono text-xs">{t.teleportID}</td>
                <td className="px-4 py-2">{t.type || "—"}</td>
                <td className="px-4 py-2">{t.realm === 0 ? "All" : (REALM_NAMES[t.realm] ?? t.realm)}</td>
                <td className="px-4 py-2">
                  <Link to={`/regions/${t.regionID}`} className="text-amber-600 hover:underline">
                    #{t.regionID}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">
                  {t.x}, {t.y}, {t.z} · {t.heading}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  {isFetching ? "Loading…" : "No teleports found."}
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
