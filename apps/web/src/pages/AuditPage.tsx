import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { auditApi } from "../lib/api";

export function AuditPage() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const { data, isFetching, error } = useQuery({
    queryKey: ["audit", action, page],
    queryFn: () => auditApi.list({ action: action || undefined, page }),
    placeholderData: (prev) => prev,
  });
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit log</h1>

      <div className="flex gap-2">
        <input
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          placeholder="Filter by action (e.g. account.reset_password)…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
        />
      </div>

      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Actor</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Target</th>
              <th className="px-4 py-2 font-medium">Details</th>
              <th className="px-4 py-2 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 align-top dark:border-slate-800">
                <td className="whitespace-nowrap px-4 py-2 text-slate-500">{e.createdAt ?? "—"}</td>
                <td className="px-4 py-2">{e.actorEmail ?? (e.actorUserId ? `#${e.actorUserId}` : "—")}</td>
                <td className="px-4 py-2 font-mono text-xs">{e.action}</td>
                <td className="px-4 py-2">{e.target ?? "—"}</td>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">
                  {e.metadata ? JSON.stringify(e.metadata) : "—"}
                </td>
                <td className="px-4 py-2 text-slate-500">{e.ip ?? "—"}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  {isFetching ? "Loading…" : "No audit entries."}
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
          disabled={items.length < 50}
          className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
        >
          Next
        </button>
      </div>
    </div>
  );
}
