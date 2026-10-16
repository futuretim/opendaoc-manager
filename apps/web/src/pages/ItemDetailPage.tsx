import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { formatMoney, itemsApi, REALM_NAMES, type ItemDetail } from "../lib/api";

export function ItemDetailPage() {
  const { idNb = "" } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["item", idNb],
    queryFn: () => itemsApi.get(idNb),
  });

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>;
  if (!data) return null;

  const it = data.item;
  const yn = (v: boolean) => (v ? "Yes" : "No");

  return (
    <div className="space-y-6">
      <div>
        <Link to="/items" className="text-sm text-amber-600 hover:underline">
          ← Items
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{it.name || it.idNb}</h1>
        <p className="font-mono text-xs text-slate-500">{it.idNb}</p>
        {it.description && <p className="mt-2 text-sm text-slate-500">{it.description}</p>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="General">
          <Row label="Level" value={it.level} />
          <Row label="Realm" value={REALM_NAMES[it.realm] ?? it.realm} />
          <Row label="Quality" value={`${it.quality}%`} />
          <Row label="Model" value={it.model} />
          <Row label="Object type" value={it.objectType} />
          <Row label="Item type (slot)" value={it.itemType} />
          <Row label="Weight" value={(it.weight / 10).toFixed(1)} />
          <Row label="Price" value={formatMoney(it.price)} />
        </Card>

        <Card title="Combat">
          <Row label="DPS / AF" value={(it.dpsAf / 10).toFixed(1)} />
          <Row label="SPD / ABS" value={(it.spdAbs / 10).toFixed(1)} />
          <Row label="Hand" value={it.hand} />
          <Row label="Damage type" value={it.typeDamage} />
          <Row label="Bonus" value={`${it.bonus}%`} />
          <Row label="Bonus level" value={it.bonusLevel} />
          <Row label="Extra bonus" value={`${it.extraBonus} (type ${it.extraBonusType})`} />
        </Card>

        <Card title="Durability & condition">
          <Row label="Durability" value={`${it.durability} / ${it.maxDurability}`} />
          <Row label="Condition" value={`${it.condition} / ${it.maxCondition}`} />
          <Row label="Indestructible" value={yn(it.isIndestructible)} />
          <Row label="No dur. loss" value={yn(it.isNotLosingDur)} />
        </Card>

        <Card title="Flags">
          <Row label="Pickable" value={yn(it.isPickable)} />
          <Row label="Dropable" value={yn(it.isDropable)} />
          <Row label="Can drop as loot" value={yn(it.canDropAsLoot)} />
          <Row label="Tradable" value={yn(it.isTradable)} />
          <Row label="Stackable" value={yn(it.isStackable)} />
          <Row label="Max count" value={it.maxCount} />
          <Row label="Pack size" value={it.packSize} />
          <Row label="Flags (raw)" value={it.flags} />
        </Card>

        <Card title="Requirements">
          <Row label="Level requirement" value={it.levelRequirement} />
          <Row label="Allowed classes" value={it.allowedClasses || "Any"} />
        </Card>

        <Card title="Charges & effects">
          <Row label="Effect" value={it.effect} />
          <Row label="Charges" value={`${it.charges} / ${it.maxCharges}`} />
          <Row label="Charges (2)" value={`${it.charges1} / ${it.maxCharges1}`} />
          <Row label="Can use every" value={`${it.canUseEvery}s`} />
          <Row
            label="Poison"
            value={`spell ${it.poisonSpellID} · ${it.poisonCharges}/${it.poisonMaxCharges}`}
          />
        </Card>

        <Card title="Appearance & misc">
          <Row label="Color" value={it.color} />
          <Row label="Emblem" value={it.emblem} />
          <Row label="Package id" value={it.packageID || "—"} />
          <Row label="Class type" value={it.classType || "—"} />
          <Row label="Salvage yield id" value={it.salvageYieldID} />
        </Card>
      </div>

      <p className="text-xs text-slate-400">
        Read-only in this release. DPS/AF, SPD/ABS and weight are shown divided by 10 (DOL storage
        convention); object/item/damage types are raw ids.
      </p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <dl className="space-y-1.5 text-sm">{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
