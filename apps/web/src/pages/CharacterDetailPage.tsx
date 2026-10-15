import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { charactersApi, REALM_NAMES } from "../lib/api";

export function CharacterDetailPage() {
  const { name = "" } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["character", name],
    queryFn: () => charactersApi.get(name),
  });

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>;
  if (!data) return null;

  const c = data.character;
  const rows: [string, string | number][] = [
    ["Account", c.accountName],
    ["Realm", REALM_NAMES[c.realm] ?? c.realm],
    ["Level", c.level],
    ["Class", c.class],
    ["Race", c.race],
    ["Realm level", c.realmLevel],
    ["Realm points", c.realmPoints],
    ["Account slot", c.accountSlot],
    ["Last played", c.lastPlayed ?? "—"],
  ];

  return (
    <div className="space-y-4">
      <div>
        <Link to="/characters" className="text-sm text-amber-600 hover:underline">
          ← Characters
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{c.name}</h1>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-t border-slate-100 first:border-t-0 dark:border-slate-800">
                <th className="w-40 bg-slate-50 px-4 py-2 font-medium text-slate-500 dark:bg-slate-900">
                  {label}
                </th>
                <td className="px-4 py-2">
                  {label === "Account" ? (
                    <Link to={`/accounts/${encodeURIComponent(c.accountName)}`} className="text-amber-600 hover:underline">
                      {value}
                    </Link>
                  ) : (
                    value
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Read-only in the MVP. Class/race are shown as raw IDs; name mapping is a later enhancement.
      </p>
    </div>
  );
}
