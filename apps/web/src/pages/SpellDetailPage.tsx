import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { DetailCard, Row } from "../components/Detail";
import { spellsApi } from "../lib/api";

export function SpellDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["spell", id],
    queryFn: () => spellsApi.get(Number(id)),
  });

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>;
  if (!data) return null;

  const sp = data.spell;
  const yn = (v: boolean) => (v ? "Yes" : "No");
  const messages = [sp.message1, sp.message2, sp.message3, sp.message4].filter(Boolean);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/spells" className="text-sm text-amber-600 hover:underline">
          ← Spells
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{sp.name || "(unnamed)"}</h1>
        <p className="text-sm text-slate-500">
          #{sp.spellID} · {sp.type || "—"}
        </p>
        {sp.description && <p className="mt-2 text-sm text-slate-500">{sp.description}</p>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DetailCard title="Targeting">
          <Row label="Target" value={sp.target} />
          <Row label="Range" value={sp.range} />
          <Row label="Radius" value={sp.radius} />
          <Row label="Duration" value={sp.duration} />
          <Row label="Frequency" value={sp.frequency} />
          <Row label="Pulse" value={sp.pulse} />
          <Row label="Concentration" value={sp.concentration} />
        </DetailCard>

        <DetailCard title="Casting & cost">
          <Row label="Power" value={sp.power} />
          <Row label="Pulse power" value={sp.pulsePower} />
          <Row label="Cast time" value={`${sp.castTime}s`} />
          <Row label="Recast delay" value={`${sp.recastDelay}s`} />
          <Row label="Uninterruptible" value={yn(sp.uninterruptible)} />
          <Row label="Move cast" value={yn(sp.moveCast)} />
          <Row label="Instrument req." value={sp.instrumentRequirement} />
        </DetailCard>

        <DetailCard title="Effect">
          <Row label="Damage" value={sp.damage} />
          <Row label="Damage type" value={sp.damageType} />
          <Row label="Value" value={sp.value} />
          <Row label="Life drain return" value={sp.lifeDrainReturn} />
          <Row label="Amnesia chance" value={sp.amnesiaChance} />
          <Row label="Resurrect health" value={sp.resurrectHealth} />
          <Row label="Resurrect mana" value={sp.resurrectMana} />
        </DetailCard>

        <DetailCard title="Grouping & flags">
          <Row label="Spell group" value={sp.spellGroup} />
          <Row label="Effect group" value={sp.effectGroup} />
          <Row label="Sub spell" value={sp.subSpellID} />
          <Row label="Shared timer group" value={sp.sharedTimerGroup} />
          <Row label="Primary / Secondary" value={`${yn(sp.isPrimary)} / ${yn(sp.isSecondary)}`} />
          <Row label="Focus" value={yn(sp.isFocus)} />
          <Row label="Allow bolt" value={yn(sp.allowBolt)} />
        </DetailCard>

        <DetailCard title="Client">
          <Row label="Client effect" value={sp.clientEffect} />
          <Row label="Icon" value={sp.icon} />
          <Row label="Tooltip id" value={sp.tooltipId} />
          <Row label="Package id" value={sp.packageID || "—"} />
        </DetailCard>
      </div>

      {messages.length > 0 && (
        <DetailCard title="Messages">
          {messages.map((m, i) => (
            <Row key={i} label={`Message ${i + 1}`} value={m} />
          ))}
        </DetailCard>
      )}

      <p className="text-xs text-slate-400">Read-only in this release.</p>
    </div>
  );
}
