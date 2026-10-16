import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { lootApi } from "../lib/api";

export function LootTemplateDetailPage() {
  const { name = "" } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["loot-template", name],
    queryFn: () => lootApi.get(name),
  });

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>;
  if (!data) return null;

  const t = data.template;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/loot-templates" className="text-sm text-amber-600 hover:underline">
          ← Loot templates
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{t.name}</h1>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Drops ({t.entries.length})</h2>
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="px-4 py-2 font-medium">Template id</th>
                <th className="px-4 py-2 font-medium">Chance</th>
                <th className="px-4 py-2 font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {t.entries.map((e) => (
                <tr key={e.itemTemplateID} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2">
                    <Link to={`/items/${encodeURIComponent(e.itemTemplateID)}`} className="text-amber-600 hover:underline">
                      {e.itemName ?? "(unknown item)"}
                    </Link>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{e.itemTemplateID}</td>
                  <td className="px-4 py-2">{e.chance}%</td>
                  <td className="px-4 py-2">{e.count}</td>
                </tr>
              ))}
              {t.entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    No item entries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Dropped by ({t.mobs.length})</h2>
        {t.mobs.length === 0 ? (
          <p className="text-sm text-slate-400">No mobs reference this template.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-2 font-medium">Mob</th>
                  <th className="px-4 py-2 font-medium">Drop count</th>
                </tr>
              </thead>
              <tbody>
                {t.mobs.map((m) => (
                  <tr key={m.mobName} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2">{m.mobName}</td>
                    <td className="px-4 py-2">{m.dropCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-400">Read-only in this release.</p>
    </div>
  );
}
