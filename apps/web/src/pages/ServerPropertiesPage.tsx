import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { serverPropertiesApi, type ServerProperty } from "../lib/api";

interface CategoryGroup {
  category: string;
  slug: string;
  items: ServerProperty[];
  modified: number;
}

const slugify = (s: string) => `cat-${s.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
const isModified = (p: ServerProperty) => p.value !== p.defaultValue;

export function ServerPropertiesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [filter, setFilter] = useState("");
  const [modifiedOnly, setModifiedOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Fetch the complete property set once; grouping and filtering are all
  // client-side so nothing is ever hidden behind pagination.
  const { data, isLoading, error } = useQuery({
    queryKey: ["server-properties", "all"],
    queryFn: () => serverPropertiesApi.all(),
  });
  const all = data?.items ?? [];

  const { groups, total, modifiedTotal } = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const filtered = all.filter((p) => {
      if (modifiedOnly && !isModified(p)) return false;
      if (needle === "") return true;
      return (
        p.key.toLowerCase().includes(needle) ||
        p.category.toLowerCase().includes(needle) ||
        (p.description ?? "").toLowerCase().includes(needle)
      );
    });

    const byCategory = new Map<string, ServerProperty[]>();
    for (const p of filtered) {
      const list = byCategory.get(p.category) ?? [];
      list.push(p);
      byCategory.set(p.category, list);
    }

    const grouped: CategoryGroup[] = [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, items]) => ({
        category,
        slug: slugify(category),
        items,
        modified: items.filter(isModified).length,
      }));

    return {
      groups: grouped,
      total: filtered.length,
      modifiedTotal: filtered.filter(isModified).length,
    };
  }, [all, filter, modifiedOnly]);

  const toggle = (slug: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Server config</h1>
        <p className="text-sm text-slate-500">
          {isLoading
            ? "Loading…"
            : `${total} setting${total === 1 ? "" : "s"} in ${groups.length} categor${
                groups.length === 1 ? "y" : "ies"
              }${modifiedTotal > 0 ? ` · ${modifiedTotal} modified` : ""}`}
        </p>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        Every OpenDAoC server property is listed here, grouped by category. Edits write to the game
        database immediately, but a <strong>running server caches these values</strong> — changes
        take effect only after it reloads its properties (the in-game
        <code> &amp;serverproperties</code> command, or a server restart).
        {!isAdmin && " Editing requires the admin role."}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by key, description, or category…"
          className="min-w-64 flex-1 rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
        />
        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={modifiedOnly}
            onChange={(e) => setModifiedOnly(e.target.checked)}
            className="h-4 w-4"
          />
          Modified from default only
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      {!isLoading && groups.length === 0 && (
        <p className="rounded-lg border border-slate-200 px-4 py-6 text-center text-slate-400 dark:border-slate-800">
          No settings match.
        </p>
      )}

      {groups.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[13rem_1fr]">
          {/* Category navigation. */}
          <nav className="hidden lg:block">
            <ul className="sticky top-4 space-y-0.5 text-sm">
              {groups.map((g) => (
                <li key={g.slug}>
                  <a
                    href={`#${g.slug}`}
                    className="flex items-center justify-between rounded px-2 py-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <span className="truncate">{g.category}</span>
                    <span className="ml-2 flex items-center gap-1 text-xs text-slate-400">
                      {g.modified > 0 && (
                        <span className="rounded-full bg-amber-400 px-1.5 font-medium text-slate-900">
                          {g.modified}
                        </span>
                      )}
                      <span>{g.items.length}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Grouped sections. */}
          <div className="min-w-0 space-y-6">
            {groups.map((g) => {
              const open = !collapsed.has(g.slug);
              return (
                <section key={g.slug} id={g.slug} className="scroll-mt-4">
                  <button
                    onClick={() => toggle(g.slug)}
                    className="mb-2 flex w-full items-center gap-2 text-left"
                  >
                    <span className="text-slate-400">{open ? "▾" : "▸"}</span>
                    <h2 className="font-semibold capitalize">{g.category}</h2>
                    <span className="text-xs text-slate-400">
                      {g.items.length}
                      {g.modified > 0 && <span className="text-amber-600"> · {g.modified} modified</span>}
                    </span>
                  </button>

                  {open && (
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
                          {g.items.map((p) => (
                            <PropertyRow key={p.key} property={p} canEdit={isAdmin} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}
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
