import { useState } from "react";
import type { ItemDetail, ItemWrite } from "../lib/api";

type Kind = "int" | "bool" | "string";

interface Field {
  key: string;
  label: string;
  kind: Kind;
  group: string;
}

// Mirrors ITEM_FIELDS on the API (keep in sync).
const FIELDS: Field[] = [
  { key: "name", label: "Name", kind: "string", group: "General" },
  { key: "description", label: "Description", kind: "string", group: "General" },
  { key: "examineArticle", label: "Examine article", kind: "string", group: "General" },
  { key: "messageArticle", label: "Message article", kind: "string", group: "General" },
  { key: "level", label: "Level", kind: "int", group: "General" },
  { key: "realm", label: "Realm (0-3)", kind: "int", group: "General" },
  { key: "quality", label: "Quality %", kind: "int", group: "General" },
  { key: "model", label: "Model", kind: "int", group: "General" },
  { key: "objectType", label: "Object type", kind: "int", group: "General" },
  { key: "itemType", label: "Item type (slot)", kind: "int", group: "General" },
  { key: "weight", label: "Weight (÷10)", kind: "int", group: "General" },
  { key: "price", label: "Price (copper)", kind: "int", group: "General" },
  { key: "dpsAf", label: "DPS/AF (÷10)", kind: "int", group: "Combat" },
  { key: "spdAbs", label: "SPD/ABS (÷10)", kind: "int", group: "Combat" },
  { key: "hand", label: "Hand", kind: "int", group: "Combat" },
  { key: "typeDamage", label: "Damage type", kind: "int", group: "Combat" },
  { key: "bonus", label: "Bonus %", kind: "int", group: "Combat" },
  { key: "bonusLevel", label: "Bonus level", kind: "int", group: "Combat" },
  { key: "extraBonus", label: "Extra bonus", kind: "int", group: "Combat" },
  { key: "extraBonusType", label: "Extra bonus type", kind: "int", group: "Combat" },
  { key: "durability", label: "Durability", kind: "int", group: "Durability" },
  { key: "maxDurability", label: "Max durability", kind: "int", group: "Durability" },
  { key: "condition", label: "Condition", kind: "int", group: "Durability" },
  { key: "maxCondition", label: "Max condition", kind: "int", group: "Durability" },
  { key: "isIndestructible", label: "Indestructible", kind: "bool", group: "Durability" },
  { key: "isNotLosingDur", label: "No durability loss", kind: "bool", group: "Durability" },
  { key: "isPickable", label: "Pickable", kind: "bool", group: "Flags" },
  { key: "isDropable", label: "Dropable", kind: "bool", group: "Flags" },
  { key: "canDropAsLoot", label: "Can drop as loot", kind: "bool", group: "Flags" },
  { key: "isTradable", label: "Tradable", kind: "bool", group: "Flags" },
  { key: "isStackable", label: "Stackable", kind: "bool", group: "Flags" },
  { key: "maxCount", label: "Max count", kind: "int", group: "Flags" },
  { key: "packSize", label: "Pack size", kind: "int", group: "Flags" },
  { key: "flags", label: "Flags (raw)", kind: "int", group: "Flags" },
  { key: "allowUpdate", label: "Allow server update", kind: "bool", group: "Flags" },
  { key: "levelRequirement", label: "Level requirement", kind: "int", group: "Requirements" },
  { key: "allowedClasses", label: "Allowed classes", kind: "string", group: "Requirements" },
  { key: "effect", label: "Effect", kind: "int", group: "Charges" },
  { key: "charges", label: "Charges", kind: "int", group: "Charges" },
  { key: "maxCharges", label: "Max charges", kind: "int", group: "Charges" },
  { key: "charges1", label: "Charges (2)", kind: "int", group: "Charges" },
  { key: "maxCharges1", label: "Max charges (2)", kind: "int", group: "Charges" },
  { key: "canUseEvery", label: "Can use every (s)", kind: "int", group: "Charges" },
  { key: "poisonSpellID", label: "Poison spell id", kind: "int", group: "Charges" },
  { key: "poisonCharges", label: "Poison charges", kind: "int", group: "Charges" },
  { key: "poisonMaxCharges", label: "Poison max charges", kind: "int", group: "Charges" },
  { key: "color", label: "Color", kind: "int", group: "Appearance" },
  { key: "emblem", label: "Emblem", kind: "int", group: "Appearance" },
  { key: "packageID", label: "Package id", kind: "string", group: "Appearance" },
  { key: "classType", label: "Class type", kind: "string", group: "Appearance" },
  { key: "salvageYieldID", label: "Salvage yield id", kind: "int", group: "Appearance" },
];

const GROUPS = ["General", "Combat", "Durability", "Flags", "Requirements", "Charges", "Appearance"];

type FormValue = string | number | boolean;

function defaultValue(kind: Kind): FormValue {
  return kind === "bool" ? false : kind === "int" ? 0 : "";
}

export function ItemForm({
  mode,
  initial,
  onSubmit,
  submitting,
  error,
}: {
  mode: "create" | "edit";
  initial?: ItemDetail;
  onSubmit: (payload: ItemWrite & { idNb?: string }) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [idNb, setIdNb] = useState(mode === "edit" ? (initial?.idNb ?? "") : "");
  const [values, setValues] = useState<Record<string, FormValue>>(() => {
    const v: Record<string, FormValue> = {};
    for (const f of FIELDS) {
      const fromInitial = initial ? (initial as unknown as Record<string, FormValue>)[f.key] : undefined;
      v[f.key] = fromInitial ?? defaultValue(f.kind);
    }
    return v;
  });

  const set = (key: string, value: FormValue) => setValues((prev) => ({ ...prev, [key]: value }));

  function handleSubmit() {
    if (mode === "create") {
      // Send everything on create (server applies defaults for anything omitted).
      onSubmit({ idNb, ...(values as ItemWrite) });
    } else {
      // Send only changed fields (column-scoped update).
      const changed: ItemWrite = {};
      for (const f of FIELDS) {
        const orig = initial ? (initial as unknown as Record<string, FormValue>)[f.key] : undefined;
        if (values[f.key] !== orig) changed[f.key] = values[f.key] as FormValue;
      }
      onSubmit(changed);
    }
  }

  return (
    <div className="space-y-6">
      {mode === "create" && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Id_nb (unique template id)</span>
            <input
              value={idNb}
              onChange={(e) => setIdNb(e.target.value)}
              placeholder="e.g. my_custom_sword"
              className="w-full max-w-sm rounded-md border border-slate-300 px-2 py-1 font-mono text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
        </div>
      )}

      {GROUPS.map((group) => (
        <section
          key={group}
          className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="mb-3 font-semibold">{group}</h2>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.filter((f) => f.group === group).map((f) => (
              <label key={f.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-600 dark:text-slate-300">{f.label}</span>
                {f.kind === "bool" ? (
                  <input
                    type="checkbox"
                    checked={Boolean(values[f.key])}
                    onChange={(e) => set(f.key, e.target.checked)}
                    className="h-4 w-4"
                  />
                ) : f.kind === "int" ? (
                  <input
                    type="number"
                    value={Number(values[f.key])}
                    onChange={(e) => set(f.key, e.target.value === "" ? 0 : Number(e.target.value))}
                    className="w-28 rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
                  />
                ) : (
                  <input
                    type="text"
                    value={String(values[f.key])}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-40 rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
                  />
                )}
              </label>
            ))}
          </div>
        </section>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={submitting || (mode === "create" && (!idNb || !values.name))}
          className="rounded-md bg-amber-500 px-5 py-2 font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-60"
        >
          {submitting ? "Saving…" : mode === "create" ? "Create item" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
