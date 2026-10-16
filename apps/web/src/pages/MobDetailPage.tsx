import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { DetailCard, Row, StatGrid } from "../components/Detail";
import { mobsApi, raceName, REALM_NAMES } from "../lib/api";

export function MobDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["mob", id],
    queryFn: () => mobsApi.get(id),
  });

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>;
  if (!data) return null;

  const m = data.mob;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/mobs" className="text-sm text-amber-600 hover:underline">
          ← Mobs
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          {m.name || "(unnamed)"} {m.suffix}
        </h1>
        <p className="text-sm text-slate-500">
          level {m.level} · {REALM_NAMES[m.realm] ?? m.realm} · {raceName(m.race)}
          {m.guild ? ` · <${m.guild}>` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DetailCard title="Location">
          <Row label="Region" value={m.region} />
          <Row label="Coordinates" value={`${m.x}, ${m.y}, ${m.z}`} />
          <Row label="Heading" value={m.heading} />
          <Row label="Speed" value={m.speed} />
          <Row label="Roaming range" value={m.roamingRange} />
          <Row label="Path" value={m.pathID || "—"} />
        </DetailCard>

        <DetailCard title="Appearance">
          <Row label="Model" value={m.model} />
          <Row label="Size" value={m.size} />
          <Row label="Gender" value={m.gender} />
          <Row label="Visible weapon slots" value={m.visibleWeaponSlots} />
          <Row label="Cloak hood up" value={m.isCloakHoodUp ? "Yes" : "No"} />
        </DetailCard>

        <DetailCard title="Behavior">
          <Row label="Brain" value={m.brain || "—"} />
          <Row label="Aggro level" value={m.aggroLevel} />
          <Row label="Aggro range" value={m.aggroRange} />
          <Row label="Respawn interval" value={`${m.respawnInterval}s`} />
          <Row label="Melee damage type" value={m.meleeDamageType} />
          <Row label="Body type" value={m.bodyType} />
          <Row label="Faction id" value={m.factionID} />
          <Row label="Flags (raw)" value={m.flags} />
        </DetailCard>

        <DetailCard title="Templates & links">
          <Row
            label="NPC template"
            value={
              m.npcTemplateID ? (
                <Link to={`/npc-templates/${m.npcTemplateID}`} className="text-amber-600 hover:underline">
                  #{m.npcTemplateID}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <Row label="Equipment template" value={m.equipmentTemplateID || "—"} />
          <Row label="Items list template" value={m.itemsListTemplateID || "—"} />
          <Row label="House number" value={m.houseNumber} />
          <Row label="Owner id" value={m.ownerID || "—"} />
          <Row label="Package id" value={m.packageID || "—"} />
          <Row label="Class type" value={m.classType || "—"} />
        </DetailCard>
      </div>

      <DetailCard title="Stats">
        <StatGrid
          stats={[
            ["STR", m.strength],
            ["CON", m.constitution],
            ["DEX", m.dexterity],
            ["QUI", m.quickness],
            ["INT", m.intelligence],
            ["PIE", m.piety],
            ["EMP", m.empathy],
            ["CHA", m.charisma],
          ]}
        />
      </DetailCard>

      <p className="font-mono text-xs text-slate-400">Mob_ID: {m.id} · read-only in this release.</p>
    </div>
  );
}
