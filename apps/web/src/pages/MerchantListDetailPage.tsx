import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { merchantsApi } from "../lib/api";

export function MerchantListDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["merchant-list", id],
    queryFn: () => merchantsApi.get(id),
  });

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>;
  if (!data) return null;

  const l = data.list;

  return (
    <div className="space-y-4">
      <div>
        <Link to="/merchant-lists" className="text-sm text-amber-600 hover:underline">
          ← Merchant lists
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{l.id}</h1>
        <p className="text-sm text-slate-500">{l.entries.length} items for sale</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">Page</th>
              <th className="px-4 py-2 font-medium">Slot</th>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 font-medium">Template id</th>
            </tr>
          </thead>
          <tbody>
            {l.entries.map((e) => (
              <tr
                key={`${e.pageNumber}-${e.slotPosition}-${e.itemTemplateID}`}
                className="border-t border-slate-100 dark:border-slate-800"
              >
                <td className="px-4 py-2">{e.pageNumber}</td>
                <td className="px-4 py-2">{e.slotPosition}</td>
                <td className="px-4 py-2">
                  <Link to={`/items/${encodeURIComponent(e.itemTemplateID)}`} className="text-amber-600 hover:underline">
                    {e.itemName ?? "(unknown item)"}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{e.itemTemplateID}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Read-only in this release.</p>
    </div>
  );
}
