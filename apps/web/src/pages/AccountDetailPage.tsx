import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  accountsApi,
  bansApi,
  PRIV_LEVEL_NAMES,
  REALM_NAMES,
  type AccountDetail,
} from "../lib/api";

export function AccountDetailPage() {
  const { name = "" } = useParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data, isLoading, error } = useQuery({
    queryKey: ["account", name],
    queryFn: () => accountsApi.get(name),
  });

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>;
  if (!data) return null;

  const { account, characters, bans } = data;
  const refetch = () => qc.invalidateQueries({ queryKey: ["account", name] });

  return (
    <div className="space-y-6">
      <div>
        <Link to="/accounts" className="text-sm text-amber-600 hover:underline">
          ← Accounts
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{account.name}</h1>
        <p className="text-sm text-slate-500">
          {PRIV_LEVEL_NAMES[account.privLevel] ?? account.privLevel} · Realm{" "}
          {REALM_NAMES[account.realm] ?? account.realm} · created {account.creationDate ?? "—"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EditAccount account={account} isAdmin={isAdmin} onSaved={refetch} />
        <ResetPassword name={account.name} />
      </div>

      {isAdmin && <RenameAccount name={account.name} characterCount={characters.length} />}

      <BansSection accountName={account.name} bans={bans} onChanged={refetch} />

      <section className="space-y-2">
        <h2 className="font-semibold">Characters ({characters.length})</h2>
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Level</th>
                <th className="px-4 py-2 font-medium">Realm</th>
                <th className="px-4 py-2 font-medium">Last played</th>
              </tr>
            </thead>
            <tbody>
              {characters.map((c) => (
                <tr key={c.name} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2">
                    <Link to={`/characters/${encodeURIComponent(c.name)}`} className="text-amber-600 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{c.level}</td>
                  <td className="px-4 py-2">{REALM_NAMES[c.realm] ?? c.realm}</td>
                  <td className="px-4 py-2 text-slate-500">{c.lastPlayed ?? "—"}</td>
                </tr>
              ))}
              {characters.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    No characters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function RenameAccount({ name, characterCount }: { name: string; characterCount: number }) {
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => accountsApi.rename(name, newName.trim()),
    onSuccess: (res) => navigate(`/accounts/${encodeURIComponent(res.account.name)}`),
    onError: (e) => setMsg((e as Error).message),
  });

  const valid = /^[A-Za-z0-9_-]{2,24}$/.test(newName.trim()) && newName.trim().toLowerCase() !== name.toLowerCase();

  return (
    <Card title="Rename account">
      <div className="space-y-3 text-sm">
        <p className="text-slate-500">
          Changes the account's login name and updates every reference to it —
          {characterCount === 1 ? " its 1 character" : ` its ${characterCount} characters`}, bans, and
          account-bound data — in one transaction. The player signs in with the new name afterward.
        </p>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setMsg(null);
            }}
            placeholder="New account name"
            className="w-full rounded-md border border-slate-300 px-2 py-1 font-mono dark:border-slate-700 dark:bg-slate-800"
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
          <p className="text-xs text-red-600">
            2–24 characters: letters, digits, underscores, or hyphens, and different from the current
            name.
          </p>
        )}
        {msg && <p className="text-xs text-slate-500">{msg}</p>}
      </div>
    </Card>
  );
}

function EditAccount({
  account,
  isAdmin,
  onSaved,
}: {
  account: AccountDetail;
  isAdmin: boolean;
  onSaved: () => void;
}) {
  const [privLevel, setPrivLevel] = useState(account.privLevel);
  const [status, setStatus] = useState(account.status);
  const [isMuted, setIsMuted] = useState(account.isMuted);
  const [isWarned, setIsWarned] = useState(account.isWarned);
  const [isTester, setIsTester] = useState(account.isTester);
  const [notes, setNotes] = useState(account.notes ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setPrivLevel(account.privLevel);
    setStatus(account.status);
    setIsMuted(account.isMuted);
    setIsWarned(account.isWarned);
    setIsTester(account.isTester);
    setNotes(account.notes ?? "");
  }, [account]);

  const mutation = useMutation({
    mutationFn: () =>
      accountsApi.update(account.name, {
        privLevel: isAdmin ? privLevel : undefined,
        status,
        isMuted,
        isWarned,
        isTester,
        notes: notes === "" ? null : notes,
      }),
    onSuccess: () => {
      setMsg("Saved.");
      onSaved();
    },
    onError: (e) => setMsg((e as Error).message),
  });

  return (
    <Card title="Moderation">
      <div className="space-y-3 text-sm">
        <label className="flex items-center justify-between gap-3">
          <span>Privilege level</span>
          <select
            value={privLevel}
            disabled={!isAdmin}
            onChange={(e) => setPrivLevel(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
          >
            <option value={1}>Player</option>
            <option value={2}>GM</option>
            <option value={3}>Admin</option>
          </select>
        </label>
        {!isAdmin && <p className="text-xs text-slate-400">Privilege level is admin-only.</p>}

        <label className="flex items-center justify-between gap-3">
          <span>Status (0–255)</span>
          <input
            type="number"
            min={0}
            max={255}
            value={status}
            onChange={(e) => setStatus(Number(e.target.value))}
            className="w-24 rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
          />
        </label>

        <Toggle label="Muted" checked={isMuted} onChange={setIsMuted} />
        <Toggle label="Warned" checked={isWarned} onChange={setIsWarned} />
        <Toggle label="Tester" checked={isTester} onChange={setIsTester} />

        <label className="block">
          <span className="mb-1 block text-slate-600 dark:text-slate-300">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
          />
        </label>

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
      </div>
    </Card>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
    </label>
  );
}

function ResetPassword({ name }: { name: string }) {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => accountsApi.resetPassword(name, password),
    onSuccess: () => {
      setMsg("Password reset.");
      setPassword("");
    },
    onError: (e) => setMsg((e as Error).message),
  });

  return (
    <Card title="Reset password">
      <div className="space-y-3 text-sm">
        <p className="text-slate-500">
          Sets a new game-account password (applied with OpenDAoC's hashing). Takes effect at the
          player's next login.
        </p>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (6–20 chars)"
          className="w-full rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setMsg(null);
              mutation.mutate();
            }}
            disabled={mutation.isPending || password.length < 6}
            className="rounded-md bg-slate-800 px-4 py-1.5 font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-700"
          >
            {mutation.isPending ? "Resetting…" : "Reset"}
          </button>
          {msg && <span className="text-slate-500">{msg}</span>}
        </div>
      </div>
    </Card>
  );
}

function BansSection({
  accountName,
  bans,
  onChanged,
}: {
  accountName: string;
  bans: { id: string; type: string; reason: string; author: string; dateBan: string | null }[];
  onChanged: () => void;
}) {
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const ban = useMutation({
    mutationFn: () => bansApi.create({ type: "A", account: accountName, reason }),
    onSuccess: () => {
      setReason("");
      setMsg("Account banned.");
      onChanged();
    },
    onError: (e) => setMsg((e as Error).message),
  });

  const lift = useMutation({
    mutationFn: (id: string) => bansApi.lift(id),
    onSuccess: () => {
      setMsg("Ban lifted.");
      onChanged();
    },
    onError: (e) => setMsg((e as Error).message),
  });

  return (
    <Card title={`Bans (${bans.length})`}>
      <div className="space-y-3 text-sm">
        {bans.length > 0 && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {bans.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <span>
                  <span className="rounded bg-red-100 px-1.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                    {b.type}
                  </span>{" "}
                  {b.reason}
                  <span className="text-slate-400"> — {b.author} {b.dateBan ? `· ${b.dateBan}` : ""}</span>
                </span>
                <button
                  onClick={() => lift.mutate(b.id)}
                  className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Lift
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason to ban this account…"
            className="w-full rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
          />
          <button
            onClick={() => {
              setMsg(null);
              ban.mutate();
            }}
            disabled={ban.isPending || reason.trim().length === 0}
            className="whitespace-nowrap rounded-md bg-red-600 px-4 py-1.5 font-medium text-white hover:bg-red-500 disabled:opacity-60"
          >
            Ban account
          </button>
        </div>
        {msg && <span className="text-slate-500">{msg}</span>}
      </div>
    </Card>
  );
}
