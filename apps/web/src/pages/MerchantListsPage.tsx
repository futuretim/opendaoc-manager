import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { merchantsApi } from "../lib/api";

export function MerchantListsPage() {
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);

  const { data, isFetching, error } = useQuery({
    queryKey: ["merchant-lists", term, page],
    queryFn: () => merchantsApi.search(term, page),
    placeholderData: (prev) => prev,
  });
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Merchant lists</h1>

      <input
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setPage(1);
        }}
        placeholder="Search by list id or item template id…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
      />

      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">List id</th>
              <th className="px-4 py-2 font-medium">Items</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-2">
                  <Link to={`/merchant-lists/${encodeURIComponent(l.id)}`} className="font-medium text-amber-600 hover:underline">
                    {l.id}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-500">{l.entries}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                  {isFetching ? "Loading…" : "No merchant lists found."}
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
