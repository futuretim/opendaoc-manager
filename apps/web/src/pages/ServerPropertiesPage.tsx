import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { serverPropertiesApi, type ServerProperty } from "../lib/api";

export function ServerPropertiesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);

  const { data, isFetching, error } = useQuery({
    queryKey: ["server-properties", term, page],
    queryFn: () => serverPropertiesApi.search(term, page),
    placeholderData: (prev) => prev,
  });
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Server config</h1>

      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        Edits write to the game database immediately, but a <strong>running server caches these
        values</strong> — changes take effect only after it reloads its properties (the in-game
        <code> &amp;serverproperties</code> command, or a server restart).
        {!isAdmin && " Editing requires the admin role."}
      </div>

      <input
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setPage(1);
        }}
        placeholder="Search by key, description, or category…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
      />

      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">Key</th>
              <th className="px-4 py-2 font-medium">Value</th>
              <th className="px-4 py-2 font-medium">Default</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <PropertyRow key={p.key} property={p} canEdit={isAdmin} />
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                  {isFetching ? "Loading…" : "No properties found."}
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

function PropertyRow({ property, canEdit }: { property: ServerProperty; canEdit: boolean }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(property.value);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => setValue(property.value), [property.value]);

  const mutation = useMutation({
    mutationFn: () => serverPropertiesApi.update(property.key, value),
    onSuccess: (res) => {
      setMsg(res.changed ? "Saved." : "No change.");
      qc.invalidateQueries({ queryKey: ["server-properties"] });
    },
    onError: (e) => setMsg((e as Error).message),
  });

  const dirty = value !== property.value;
  const nonDefault = property.value !== property.defaultValue;

  return (
    <tr className="border-t border-slate-100 align-top dark:border-slate-800">
      <td className="px-4 py-2">
        <div className="font-mono text-xs font-medium">{property.key}</div>
        <div className="text-xs text-slate-400">{property.category}</div>
        {property.description && (
          <div className="mt-0.5 max-w-md text-xs text-slate-500">{property.description}</div>
        )}
      </td>
      <td className="px-4 py-2">
        {canEdit ? (
          <div className="flex items-center gap-2">
            <input
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setMsg(null);
              }}
              className={`w-40 rounded-md border px-2 py-1 font-mono text-xs dark:bg-slate-800 ${
                nonDefault ? "border-amber-400" : "border-slate-300 dark:border-slate-700"
              }`}
            />
            <button
              onClick={() => mutation.mutate()}
              disabled={!dirty || mutation.isPending}
              className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-40"
            >
              Save
            </button>
            {msg && <span className="text-xs text-slate-500">{msg}</span>}
          </div>
        ) : (
          <span className={`font-mono text-xs ${nonDefault ? "text-amber-600" : ""}`}>
            {property.value}
          </span>
        )}
      </td>
      <td className="px-4 py-2 font-mono text-xs text-slate-400">{property.defaultValue}</td>
    </tr>
  );
}
