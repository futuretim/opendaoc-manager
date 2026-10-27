import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  inventoryApi,
  itemsApi,
  type InventoryItem,
  type InventoryScope,
  type ItemSummary,
} from "../lib/api";

interface InventoryManagerProps {
  characterName: string;
  accountName: string;
  realm: number;
  guildName: string | null;
  guildId: string | null;
  /** Granting and removing items is admin-only (the API enforces it too). */
  isAdmin: boolean;
}

const SCOPE_TABS: { key: InventoryScope; label: string }[] = [
  { key: "character", label: "Character Inventory" },
  { key: "guild", label: "Guild Vault" },
  { key: "account", label: "Account Vault" },
];

export function InventoryManager({
  characterName,
  accountName,
  realm,
  guildName,
  guildId,
  isAdmin,
}: InventoryManagerProps) {
  const [scope, setScope] = useState<InventoryScope>("character");
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["inventory", characterName, scope],
    queryFn: () => inventoryApi.list(characterName, scope),
    retry: false,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["inventory", characterName, scope] });

  const hasGuild = guildId !== null && guildName !== null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 font-semibold">Inventory</h2>

      {/* Scope tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
        {SCOPE_TABS.map((tab) => {
          const disabled = tab.key === "guild" && !hasGuild;
          return (
            <button
              key={tab.key}
              onClick={() => !disabled && setScope(tab.key)}
              disabled={disabled}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                scope === tab.key
                  ? "border-amber-500 text-amber-600 dark:text-amber-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Scope description */}
      <p className="mb-3 text-xs text-slate-400">
        {scope === "character" &&
          "Equipped gear, backpack, horse bags, and personal vault for this character."}
        {scope === "guild" && hasGuild &&
          `Shared guild vault for ${guildName}. Stored in the guild house vault slots.`}
        {scope === "account" &&
          `Account-wide vault for ${accountName} (realm ${realm}). Shared across all characters on this account in this realm.`}
      </p>

      {scope === "guild" && !hasGuild && (
        <p className="text-sm text-slate-500">This character is not in a guild.</p>
      )}

      {scope !== "guild" || hasGuild ? (
        <>
          {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
          {error && (
            <p className="text-sm text-red-600">
              {(error as Error).message}
            </p>
          )}
          {data && (
            <>
              {isAdmin && (
                <GrantItemForm
                  characterName={characterName}
                  scope={scope}
                  existingSlots={data.items.map((i) => i.slotPosition)}
                  onGranted={invalidate}
                />
              )}
              <ItemTable
                items={data.items}
                canRemove={isAdmin}
                onChanged={invalidate}
              />
            </>
          )}
        </>
      ) : null}

      <p className="mt-3 text-xs text-slate-400">
        Changes write to the game database directly and apply at the player's next login. They
        are refused while the player (or, for the guild vault, any guild member) is online, since
        the server would overwrite them. Items can be placed in bags and vaults, not equipment slots.
      </p>
    </section>
  );
}

function ItemTable({
  items,
  canRemove,
  onChanged,
}: {
  items: InventoryItem[];
  canRemove: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editSlot, setEditSlot] = useState(0);
  const [editCount, setEditCount] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (item: InventoryItem) =>
      inventoryApi.update(item.inventoryId, {
        slotPosition: editSlot,
        count: editCount,
      }),
    onSuccess: () => {
      setEditing(null);
      setMsg(null);
      onChanged();
    },
    onError: (e) => setMsg((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (item: InventoryItem) => inventoryApi.remove(item.inventoryId),
    onSuccess: () => {
      setMsg(null);
      onChanged();
    },
    onError: (e) => setMsg((e as Error).message),
  });

  if (items.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-500">No items.</p>;
  }

  // Group items by slot range for display
  const groups = groupBySlot(items);

  return (
    <div className="space-y-4">
      {msg && <p className="text-xs text-red-600">{msg}</p>}
      {groups.map(([groupName, groupItems]) => (
        <div key={groupName}>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {groupName} ({groupItems.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700">
                  <th className="px-2 py-1">Slot</th>
                  <th className="px-2 py-1">Item</th>
                  <th className="px-2 py-1">Lv</th>
                  <th className="px-2 py-1">Qual</th>
                  <th className="px-2 py-1">Count</th>
                  <th className="px-2 py-1">Cond/Dur</th>
                  <th className="px-2 py-1">Charges</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {groupItems.map((item) => (
                  <tr
                    key={item.inventoryId}
                    className="border-b border-slate-100 last:border-b-0 dark:border-slate-800"
                  >
                    <td className="px-2 py-1 font-mono text-xs">
                      {editing === item.inventoryId ? (
                        <input
                          type="number"
                          value={editSlot}
                          onChange={(e) => setEditSlot(Number(e.target.value))}
                          className="w-16 rounded border border-slate-300 px-1 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                      ) : (
                        item.slotPosition
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {item.itemTemplateId || item.itemUniqueId ? (
                        <Link
                          to={`/items/${encodeURIComponent(item.itemTemplateId ?? item.itemUniqueId ?? "")}`}
                          className="text-amber-600 hover:underline"
                        >
                          {item.name}
                        </Link>
                      ) : (
                        item.name
                      )}
                      {item.isCrafted && (
                        <span className="ml-1 text-xs text-slate-400">(crafted)</span>
                      )}
                    </td>
                    <td className="px-2 py-1">{item.level}</td>
                    <td className="px-2 py-1">
                      <QualityBadge quality={item.quality} />
                    </td>
                    <td className="px-2 py-1">
                      {editing === item.inventoryId ? (
                        <input
                          type="number"
                          min={1}
                          value={editCount}
                          onChange={(e) => setEditCount(Number(e.target.value))}
                          className="w-16 rounded border border-slate-300 px-1 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                      ) : (
                        item.count
                      )}
                    </td>
                    <td className="px-2 py-1 text-xs text-slate-500">
                      {item.maxCondition > 0
                        ? `${Math.round((item.condition / item.maxCondition) * 100)}% / ${Math.round((item.durability / item.maxDurability) * 100)}%`
                        : "—"}
                    </td>
                    <td className="px-2 py-1 text-xs text-slate-500">
                      {item.maxCharges > 0 ? `${item.charges}/${item.maxCharges}` : "—"}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {editing === item.inventoryId ? (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => updateMutation.mutate(item)}
                            disabled={updateMutation.isPending}
                            className="rounded bg-amber-500 px-2 py-0.5 text-xs font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-40"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditing(null);
                              setMsg(null);
                            }}
                            className="rounded bg-slate-200 px-2 py-0.5 text-xs hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditing(item.inventoryId);
                              setEditSlot(item.slotPosition);
                              setEditCount(item.count);
                              setMsg(null);
                            }}
                            className="rounded bg-slate-100 px-2 py-0.5 text-xs hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                          >
                            Edit
                          </button>
                          {canRemove && (
                            <button
                              onClick={() => {
                                if (confirm(`Remove "${item.name}" from inventory?`)) {
                                  deleteMutation.mutate(item);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                              className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 hover:bg-red-200 disabled:opacity-40 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function GrantItemForm({
  characterName,
  scope,
  existingSlots,
  onGranted,
}: {
  characterName: string;
  scope: InventoryScope;
  existingSlots: number[];
  onGranted: () => void;
}) {
  const [itemId, setItemId] = useState("");
  const [slot, setSlot] = useState("");
  const [count, setCount] = useState(1);
  const [searchQ, setSearchQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  const searchQuery = useQuery({
    queryKey: ["itemSearch", searchQ],
    queryFn: () => itemsApi.search(searchQ, 1),
    enabled: showSearch && searchQ.trim().length >= 2,
  });

  const grantMutation = useMutation({
    mutationFn: () =>
      inventoryApi.grant(characterName, {
        scope,
        itemTemplateId: itemId.trim(),
        slotPosition: Number(slot),
        count,
      }),
    onSuccess: () => {
      setItemId("");
      setSlot("");
      setCount(1);
      setMsg("Item granted.");
      onGranted();
    },
    onError: (e) => setMsg((e as Error).message),
  });

  const valid =
    itemId.trim() !== "" &&
    slot !== "" &&
    Number(slot) >= 0 &&
    !existingSlots.includes(Number(slot));

  return (
    <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Grant item
      </h3>
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative">
          <label className="block text-xs text-slate-500">Item template ID</label>
          <div className="flex gap-1">
            <input
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value);
                setMsg(null);
              }}
              placeholder="e.g. sword_cloth_01"
              className="w-48 rounded-md border border-slate-300 px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="rounded-md bg-slate-200 px-2 py-1 text-xs hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              Search
            </button>
          </div>
          {showSearch && (
            <div className="mt-1 w-64">
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search items by name…"
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              {searchQuery.data && searchQuery.data.items.length > 0 && (
                <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  {searchQuery.data.items.map((it: ItemSummary) => (
                    <button
                      key={it.idNb}
                      onClick={() => {
                        setItemId(it.idNb);
                        setShowSearch(false);
                        setSearchQ("");
                      }}
                      className="block w-full px-2 py-1 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <span className="font-mono text-slate-400">{it.idNb}</span> {it.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs text-slate-500">Slot</label>
          <input
            type="number"
            value={slot}
            onChange={(e) => {
              setSlot(e.target.value);
              setMsg(null);
            }}
            placeholder="e.g. 40"
            className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Count</label>
          <input
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-16 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <button
          onClick={() => {
            setMsg(null);
            grantMutation.mutate();
          }}
          disabled={!valid || grantMutation.isPending}
          className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-40"
        >
          {grantMutation.isPending ? "Granting…" : "Grant"}
        </button>
      </div>
      {slot !== "" && existingSlots.includes(Number(slot)) && (
        <p className="mt-1 text-xs text-red-600">Slot {slot} is already occupied.</p>
      )}
      {msg && <p className="mt-1 text-xs text-slate-500">{msg}</p>}
    </div>
  );
}

function QualityBadge({ quality }: { quality: number }) {
  const colors: Record<number, string> = {
    0: "text-slate-400",
    1: "text-slate-500",
    2: "text-green-600",
    3: "text-blue-600",
    4: "text-purple-600",
    5: "text-orange-600",
    6: "text-red-600",
  };
  const labels: Record<number, string> = {
    0: "—",
    1: "1%",
    2: "2%",
    3: "3%",
    4: "4%",
    5: "5%",
    6: "6%",
  };
  return (
    <span className={colors[quality] ?? "text-slate-500"}>
      {labels[quality] ?? `${quality}%`}
    </span>
  );
}

function groupBySlot(items: InventoryItem[]): [string, InventoryItem[]][] {
  const groups = new Map<string, InventoryItem[]>();
  for (const item of items) {
    const name = slotGroupLabel(item.slotPosition);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(item);
  }
  // Sort groups by their minimum slot
  const order = ["Equipped", "Backpack", "Horse Bags", "Personal Vault", "Guild Vault", "Account Vault", "Other"];
  return [...groups.entries()].sort(
    (a, b) => order.indexOf(a[0]) - order.indexOf(b[0]),
  );
}

function slotGroupLabel(slot: number): string {
  if (slot >= 7 && slot <= 37) return "Equipped";
  if (slot >= 40 && slot <= 79) return "Backpack";
  if (slot >= 80 && slot <= 95) return "Horse Bags";
  if (slot >= 110 && slot <= 149) return "Personal Vault";
  if (slot >= 1000 && slot <= 1799) return "Guild Vault";
  if (slot >= 2500 && slot <= 2699) return "Account Vault";
  return "Other";
}
