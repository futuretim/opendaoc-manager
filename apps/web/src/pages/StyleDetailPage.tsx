import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { DetailCard, Row } from "../components/Detail";
import { stylesApi } from "../lib/api";

export function StyleDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["style", id],
    queryFn: () => stylesApi.get(Number(id)),
  });

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>;
  if (!data) return null;

  const st = data.style;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/styles" className="text-sm text-amber-600 hover:underline">
          ← Styles
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{st.name || "(unnamed)"}</h1>
        <p className="text-sm text-slate-500">
          #{st.styleID} · {st.specKeyName || "—"} (level {st.specLevelRequirement}) · class {st.classId}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DetailCard title="Opening requirement">
          <Row label="Type" value={st.openingRequirementType} />
          <Row label="Value" value={st.openingRequirementValue} />
          <Row label="Attack result" value={st.attackResultRequirement} />
          <Row label="Weapon type" value={st.weaponTypeRequirement} />
          <Row label="Stealth required" value={st.stealthRequirement ? "Yes" : "No"} />
        </DetailCard>

        <DetailCard title="Combat">
          <Row label="Endurance cost" value={st.enduranceCost} />
          <Row label="Growth offset" value={st.growthOffset} />
          <Row label="Growth rate" value={st.growthRate} />
          <Row label="Bonus to hit" value={st.bonusToHit} />
          <Row label="Bonus to defense" value={st.bonusToDefense} />
          <Row label="Random proc" value={st.randomProc ? "Yes" : "No"} />
        </DetailCard>

        <DetailCard title="Animation & misc">
          <Row label="Icon" value={st.icon} />
          <Row label="Two-hand animation" value={st.twoHandAnimation} />
          <Row label="Armor hit location" value={st.armorHitLocation} />
        </DetailCard>
      </div>

      <p className="text-xs text-slate-400">
        Read-only in this release. Opening/attack-result/weapon-type are raw ids.
      </p>
    </div>
  );
}
