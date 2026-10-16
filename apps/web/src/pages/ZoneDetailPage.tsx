import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { DetailCard, Row } from "../components/Detail";
import { REALM_NAMES, zonesApi } from "../lib/api";

export function ZoneDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["zone", id],
    queryFn: () => zonesApi.get(Number(id)),
  });

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>;
  if (!data) return null;

  const z = data.zone;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/zones" className="text-sm text-amber-600 hover:underline">
          ← Zones
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{z.name || "(unnamed)"}</h1>
        <p className="text-sm text-slate-500">
          zone #{z.zoneID} · region{" "}
          <Link to={`/regions/${z.regionID}`} className="text-amber-600 hover:underline">
            #{z.regionID}
          </Link>{" "}
          · {REALM_NAMES[z.realm] ?? z.realm}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DetailCard title="Geometry">
          <Row label="Width × Height" value={`${z.width} × ${z.height}`} />
          <Row label="Offset X" value={z.offsetX} />
          <Row label="Offset Y" value={z.offsetY} />
          <Row label="Is lava" value={z.isLava ? "Yes" : "No"} />
          <Row label="Diving flag" value={z.divingFlag} />
          <Row label="Water level" value={z.waterLevel} />
        </DetailCard>

        <DetailCard title="Reward modifiers">
          <Row label="Experience" value={z.experience} />
          <Row label="Realm points" value={z.realmpoints} />
          <Row label="Bounty points" value={z.bountypoints} />
          <Row label="Coin" value={z.coin} />
        </DetailCard>
      </div>

      <p className="text-xs text-slate-400">Read-only in this release.</p>
    </div>
  );
}
