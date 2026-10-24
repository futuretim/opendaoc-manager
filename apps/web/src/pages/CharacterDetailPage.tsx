import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  charactersApi,
  className,
  raceName,
  REALM_NAMES,
  type CharacterDetail,
} from "../lib/api";

export function CharacterDetailPage() {
  const { name = "" } = useParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, isLoading, error } = useQuery({
    queryKey: ["character", name],
    queryFn: () => charactersApi.get(name),
  });

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>;
  if (!data) return null;

  const c = data.character;
  const refetch = () => qc.invalidateQueries({ queryKey: ["character", name] });
  const rows: [string, string | number][] = [
    ["Account", c.accountName],
    ["Realm", REALM_NAMES[c.realm] ?? c.realm],
    ["Class", className(c.class)],
    ["Race", raceName(c.race)],
    ["Account slot", c.accountSlot],
    ["Last played", c.lastPlayed ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/characters" className="text-sm text-amber-600 hover:underline">
          ← Characters
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{c.name}</h1>
        <p className="text-sm text-slate-500">
          {className(c.class)} · {raceName(c.race)} · Realm {REALM_NAMES[c.realm] ?? c.realm}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EditCharacter character={c} onSaved={refetch} />

        <section className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
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
        </section>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RenameCharacter name={c.name} />
          <MoveCharacter name={c.name} currentAccount={c.accountName} onMoved={refetch} />
        </div>
      )}
    </div>
  );
}

function CharCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="space-y-3 text-sm">{children}</div>
    </section>
  );
}

function RenameCharacter({ name }: { name: string }) {
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => charactersApi.rename(name, newName.trim()),
    onSuccess: (res) => navigate(`/characters/${encodeURIComponent(res.character.name)}`),
    onError: (e) => setMsg((e as Error).message),
  });

  const valid =
    /^[A-Za-z]{2,24}$/.test(newName.trim()) && newName.trim().toLowerCase() !== name.toLowerCase();

  return (
    <CharCard title="Rename character">
      <p className="text-slate-500">
        Renames this character. Names are unique server-wide; inventory, skills, and guild membership
        follow the character automatically.
      </p>
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            setMsg(null);
          }}
          placeholder="New character name"
          className="w-full rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
        />
        <button
          onClick={() => {
            setMsg(null);
            mutation.mutate();
          }}
          disabled={!valid || mutation.isPending}
          className="whitespace-nowrap rounded-md bg-amber-500 px-4 py-1.5 font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-40"
        >
          {mutation.isPending ? "Renaming…" : "Rename"}
        </button>
      </div>
      {newName.trim() !== "" && !valid && (
        <p className="text-xs text-red-600">2–24 letters, and different from the current name.</p>
      )}
      {msg && <p className="text-xs text-slate-500">{msg}</p>}
    </CharCard>
  );
}

function MoveCharacter({
  name,
  currentAccount,
  onMoved,
}: {
  name: string;
  currentAccount: string;
  onMoved: () => void;
}) {
  const [toAccount, setToAccount] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => charactersApi.move(name, toAccount.trim()),
    onSuccess: (res) => {
      setMsg(`Moved to ${res.character.accountName} (slot ${res.slot}).`);
      setToAccount("");
      onMoved();
    },
    onError: (e) => setMsg((e as Error).message),
  });

  const valid =
    toAccount.trim() !== "" && toAccount.trim().toLowerCase() !== currentAccount.toLowerCase();

  return (
    <CharCard title="Move to account">
      <p className="text-slate-500">
        Moves this character to another account, keeping its realm and taking the first free slot
        there. Apply while the player is offline — a running server rewrites a logged-in character on
        its next save.
      </p>
      <div className="flex gap-2">
        <input
          value={toAccount}
          onChange={(e) => {
            setToAccount(e.target.value);
            setMsg(null);
          }}
          placeholder="Destination account name"
          className="w-full rounded-md border border-slate-300 px-2 py-1 font-mono dark:border-slate-700 dark:bg-slate-800"
        />
        <button
          onClick={() => {
            setMsg(null);
            mutation.mutate();
          }}
          disabled={!valid || mutation.isPending}
          className="whitespace-nowrap rounded-md bg-slate-800 px-4 py-1.5 font-medium text-white hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-700"
        >
          {mutation.isPending ? "Moving…" : "Move"}
        </button>
      </div>
      {toAccount.trim() !== "" && !valid && (
        <p className="text-xs text-red-600">Enter a different account than the current one.</p>
      )}
      {msg && <p className="text-xs text-slate-500">{msg}</p>}
    </CharCard>
  );
}

function EditCharacter({
  character,
  onSaved,
}: {
  character: CharacterDetail;
  onSaved: () => void;
}) {
  const [level, setLevel] = useState(character.level);
  const [realmLevel, setRealmLevel] = useState(character.realmLevel);
  const [realmPoints, setRealmPoints] = useState(character.realmPoints);
  const [bountyPoints, setBountyPoints] = useState(character.bountyPoints);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setLevel(character.level);
    setRealmLevel(character.realmLevel);
    setRealmPoints(character.realmPoints);
    setBountyPoints(character.bountyPoints);
  }, [character]);

  const mutation = useMutation({
    mutationFn: () =>
      charactersApi.update(character.name, {
        level,
        realmLevel,
        realmPoints,
        bountyPoints,
      }),
    onSuccess: () => {
      setMsg("Saved.");
      onSaved();
    },
    onError: (e) => setMsg((e as Error).message),
  });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 font-semibold">Progression</h2>
      <div className="space-y-3 text-sm">
        <NumberField label="Level" min={1} max={50} value={level} onChange={setLevel} />
        <NumberField
          label="Realm level"
          min={0}
          max={120}
          value={realmLevel}
          onChange={setRealmLevel}
        />
        <NumberField
          label="Realm points"
          min={0}
          value={realmPoints}
          onChange={setRealmPoints}
          wide
        />
        <NumberField
          label="Bounty points"
          min={0}
          value={bountyPoints}
          onChange={setBountyPoints}
          wide
        />

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setMsg(null);
              mutation.mutate();
            }}
            disabled={mutation.isPending}
            className="rounded-md bg-amber-500 px-4 py-1.5 font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-60"
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
          {msg && <span className="text-slate-500">{msg}</span>}
        </div>

        <p className="text-xs text-slate-400">
          Writes the character row directly. Changes apply at the player's next login; if they are
          online, the server overwrites them on the character's next save.
        </p>
      </div>
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  wide,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  wide?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${wide ? "w-32" : "w-24"} rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800`}
      />
    </label>
  );
}
