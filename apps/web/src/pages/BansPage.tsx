import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { bansApi, type BanType } from "../lib/api";

const TYPE_LABEL: Record<BanType, string> = { A: "Account", I: "IP", B: "Both" };

export function BansPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<BanType | "">("");
  const { data, error } = useQuery({
    queryKey: ["bans", filter],
    queryFn: () => bansApi.list(filter),
  });
  const items = data?.items ?? [];

  const lift = useMutation({
    mutationFn: (id: string) => bansApi.lift(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bans"] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Bans</h1>

      <CreateBan onCreated={() => qc.invalidateQueries({ queryKey: ["bans"] })} />

      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">Filter:</span>
        {(["", "A", "I", "B"] as const).map((t) => (
          <button
            key={t || "all"}
            onClick={() => setFilter(t)}
            className={`rounded-md px-3 py-1 ${
              filter === t
                ? "bg-amber-500 font-medium text-slate-900"
                : "border border-slate-300 dark:border-slate-700"
            }`}
          >
            {t === "" ? "All" : TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Account</th>
              <th className="px-4 py-2 font-medium">IP</th>
              <th className="px-4 py-2 font-medium">Reason</th>
              <th className="px-4 py-2 font-medium">Author</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-2">{TYPE_LABEL[b.type]}</td>
                <td className="px-4 py-2">{b.account || "—"}</td>
                <td className="px-4 py-2">{b.ip || "—"}</td>
                <td className="px-4 py-2">{b.reason}</td>
                <td className="px-4 py-2 text-slate-500">{b.author}</td>
                <td className="px-4 py-2 text-slate-500">{b.dateBan ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => lift.mutate(b.id)}
                    className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    Lift
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No bans.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateBan({ onCreated }: { onCreated: () => void }) {
  const [type, setType] = useState<BanType>("A");
  const [account, setAccount] = useState("");
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      bansApi.create({
        type,
        account: type === "I" ? undefined : account,
        ip: type === "A" ? undefined : ip,
        reason,
      }),
    onSuccess: () => {
      setMsg("Ban created.");
      setAccount("");
      setIp("");
      setReason("");
      onCreated();
    },
    onError: (e) => setMsg((e as Error).message),
  });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 font-semibold">Create ban</h2>
      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as BanType)}
          className="rounded-md border border-slate-300 px-2 py-2 dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="A">Account</option>
          <option value="I">IP</option>
          <option value="B">Both</option>
        </select>
        <input
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="Account name"
          disabled={type === "I"}
          className="rounded-md border border-slate-300 px-2 py-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
        />
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="IP address"
          disabled={type === "A"}
          className="rounded-md border border-slate-300 px-2 py-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required)"
          className="rounded-md border border-slate-300 px-2 py-2 dark:border-slate-700 dark:bg-slate-800"
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => {
            setMsg(null);
            mutation.mutate();
          }}
          disabled={mutation.isPending || reason.trim().length === 0}
          className="rounded-md bg-red-600 px-4 py-1.5 font-medium text-white hover:bg-red-500 disabled:opacity-60"
        >
          {mutation.isPending ? "Creating…" : "Create ban"}
        </button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
    </section>
  );
}
