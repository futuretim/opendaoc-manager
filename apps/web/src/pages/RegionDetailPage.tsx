import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { DetailCard, Row } from "../components/Detail";
import { regionsApi } from "../lib/api";

export function RegionDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["region", id],
    queryFn: () => regionsApi.get(Number(id)),
  });

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>;
  if (!data) return null;

  const r = data.region;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/regions" className="text-sm text-amber-600 hover:underline">
          ← Regions
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{r.name || "(unnamed)"}</h1>
        <p className="text-sm text-slate-500">
          region #{r.regionID}
          {r.description ? ` · ${r.description}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DetailCard title="Properties">
          <Row label="Expansion" value={r.expansion} />
          <Row label="Frontier" value={r.isFrontier ? "Yes" : "No"} />
          <Row label="Housing enabled" value={r.housingEnabled ? "Yes" : "No"} />
          <Row label="Diving enabled" value={r.divingEnabled ? "Yes" : "No"} />
          <Row label="Water level" value={r.waterLevel} />
          <Row label="Class type" value={r.classType || "—"} />
        </DetailCard>

        <DetailCard title="Server">
          <Row label="IP" value={r.ip || "—"} />
          <Row label="Port" value={r.port || "—"} />
        </DetailCard>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Zones ({r.zones.length})</h2>
        {r.zones.length === 0 ? (
          <p className="text-sm text-slate-400">No zones in this region.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {r.zones.map((z) => (
              <Link
                key={z.zoneID}
                to={`/zones/${z.zoneID}`}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-amber-600 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                {z.name || `Zone ${z.zoneID}`}{" "}
                <span className="text-slate-400">#{z.zoneID}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-slate-400">Read-only in this release.</p>
    </div>
  );
}
