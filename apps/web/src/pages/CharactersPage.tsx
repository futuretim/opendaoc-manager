import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { charactersApi, REALM_NAMES } from "../lib/api";

export function CharactersPage() {
  const [term, setTerm] = useState("");
  const [realm, setRealm] = useState<number | "">("");
  const [page, setPage] = useState(1);

  const { data, isFetching, error } = useQuery({
    queryKey: ["characters", term, realm, page],
    queryFn: () => charactersApi.search(term, realm === "" ? undefined : realm, page),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Characters</h1>

      <div className="flex gap-2">
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setPage(1);
          }}
          placeholder="Search by character or account name…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
        />
        <select
          value={realm}
          onChange={(e) => {
            setRealm(e.target.value === "" ? "" : Number(e.target.value));
            setPage(1);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All realms</option>
          <option value={1}>Albion</option>
          <option value={2}>Midgard</option>
          <option value={3}>Hibernia</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Account</th>
              <th className="px-4 py-2 font-medium">Level</th>
              <th className="px-4 py-2 font-medium">Realm</th>
              <th className="px-4 py-2 font-medium">Last played</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.name} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-2">
                  <Link to={`/characters/${encodeURIComponent(c.name)}`} className="font-medium text-amber-600 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <Link to={`/accounts/${encodeURIComponent(c.accountName)}`} className="text-slate-600 hover:underline dark:text-slate-300">
                    {c.accountName}
                  </Link>
                </td>
                <td className="px-4 py-2">{c.level}</td>
                <td className="px-4 py-2">{REALM_NAMES[c.realm] ?? c.realm}</td>
                <td className="px-4 py-2 text-slate-500">{c.lastPlayed ?? "—"}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  {isFetching ? "Loading…" : "No characters found."}
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
