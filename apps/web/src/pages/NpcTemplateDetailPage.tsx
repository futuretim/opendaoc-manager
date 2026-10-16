import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { DetailCard, Row, StatGrid } from "../components/Detail";
import { npcTemplatesApi, raceName } from "../lib/api";

export function NpcTemplateDetailPage() {
  const { templateId = "" } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["npc-template", templateId],
    queryFn: () => npcTemplatesApi.get(Number(templateId)),
  });

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>;
  if (!data) return null;

  const t = data.template;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/npc-templates" className="text-sm text-amber-600 hover:underline">
          ← NPC templates
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          {t.name || "(unnamed)"} {t.suffix}
        </h1>
        <p className="text-sm text-slate-500">
          template #{t.templateId} · level {t.level} · {raceName(t.race)}
          {t.guildName ? ` · <${t.guildName}>` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DetailCard title="Appearance">
          <Row label="Model" value={t.model} />
          <Row label="Size" value={t.size} />
          <Row label="Gender" value={t.gender} />
          <Row label="Max speed" value={t.maxSpeed} />
          <Row label="Visible weapon slots" value={t.visibleWeaponSlots} />
        </DetailCard>

        <DetailCard title="Behavior">
          <Row label="Aggro level" value={t.aggroLevel} />
          <Row label="Aggro range" value={t.aggroRange} />
          <Row label="Body type" value={t.bodyType} />
          <Row label="Max distance" value={t.maxDistance} />
          <Row label="Tether range" value={t.tetherRange} />
          <Row label="Faction id" value={t.factionID} />
          <Row label="Flags (raw)" value={t.flags} />
          <Row label="Replace mob values" value={t.replaceMobValues ? "Yes" : "No"} />
        </DetailCard>

        <DetailCard title="Combat">
          <Row label="Melee damage type" value={t.meleeDamageType} />
          <Row label="Parry %" value={t.parryChance} />
          <Row label="Evade %" value={t.evadeChance} />
          <Row label="Block %" value={t.blockChance} />
          <Row label="Left-hand swing %" value={t.leftHandSwingChance} />
        </DetailCard>

        <DetailCard title="Equipment">
          <Row label="Equipment template" value={t.equipmentTemplateID || "—"} />
          <Row label="Items list template" value={t.itemsListTemplateID || "—"} />
          <Row label="Package id" value={t.packageID || "—"} />
          <Row label="Class type" value={t.classType || "—"} />
        </DetailCard>
      </div>

      <DetailCard title="Stats">
        <StatGrid
          stats={[
            ["STR", t.strength],
            ["CON", t.constitution],
            ["DEX", t.dexterity],
            ["QUI", t.quickness],
            ["INT", t.intelligence],
            ["PIE", t.piety],
            ["EMP", t.empathy],
            ["CHA", t.charisma],
          ]}
        />
      </DetailCard>

      <DetailCard title="Spells, styles & abilities">
        <Row label="Spells" value={t.spells || "—"} />
        <Row label="Styles" value={t.styles || "—"} />
        <Row label="Abilities" value={t.abilities || "—"} />
      </DetailCard>

      <p className="text-xs text-slate-400">Read-only in this release.</p>
    </div>
  );
}
