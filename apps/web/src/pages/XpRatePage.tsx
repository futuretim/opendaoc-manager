import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { serverRatesApi } from "../lib/api";

const PRESETS = [0.5, 1, 2, 3, 5, 10];

export function XpRatePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["xp-rate"],
    queryFn: () => serverRatesApi.getXp(),
  });
  const rate = data?.rate;

  const [input, setInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  // Sync the editable field whenever the server value (re)loads.
  useEffect(() => {
    if (rate) setInput(rate.value);
  }, [rate?.value]);

  const mutation = useMutation({
    mutationFn: (value: number) => serverRatesApi.setXp(value),
    onSuccess: (res) => {
      setMsg(res.changed ? "Saved." : "No change — already set to that value.");
      qc.setQueryData(["xp-rate"], res);
    },
    onError: (e) => setMsg((e as Error).message),
  });

  const parsed = Number(input.trim());
  const valid = input.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 && (!rate || parsed <= rate.max);
  const dirty = rate ? input.trim() !== rate.value : false;

  function save(value: number) {
    setMsg(null);
    mutation.mutate(value);
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">XP rate</h1>
        <p className="mt-1 text-sm text-slate-500">
          The global experience multiplier (<code className="font-mono">xp_rate</code>) applied to all
          XP earned on this server. <strong>1</strong> is the normal rate, <strong>2</strong> is double
          XP, and so on.
        </p>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        Saving writes to the game database immediately, but a <strong>running server caches this
        value</strong> — the change takes effect only after it reloads its properties (the in-game
        <code> &amp;serverproperties</code> command, or a server restart).
        {!isAdmin && " Editing requires the admin role."}
      </div>

      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}
      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {rate && (
        <div className="space-y-5 rounded-lg border border-slate-200 p-5 dark:border-slate-800">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-500">Current multiplier</span>
            <span className="font-mono text-2xl font-semibold">{rate.multiplier}×</span>
          </div>
          <div className="flex items-baseline justify-between text-xs text-slate-400">
            <span>Server default</span>
            <span className="font-mono">{rate.defaultMultiplier}×</span>
          </div>

          {isAdmin ? (
            <>
              <div className="flex items-end gap-3">
                <label className="flex-1">
                  <span className="mb-1 block text-xs font-medium text-slate-500">New multiplier</span>
                  <input
                    type="number"
                    min={0}
                    max={rate.max}
                    step="0.1"
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      setMsg(null);
                    }}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
                <button
                  onClick={() => save(parsed)}
                  disabled={!valid || !dirty || mutation.isPending}
                  className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-40"
                >
                  {mutation.isPending ? "Saving…" : "Save"}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">Presets:</span>
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setInput(String(p))}
                    className={`rounded-md border px-2.5 py-1 font-mono text-xs transition ${
                      input.trim() === String(p)
                        ? "border-amber-400 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                        : "border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    }`}
                  >
                    {p}×
                  </button>
                ))}
              </div>

              {input.trim() !== "" && !valid && (
                <p className="text-xs text-red-600">
                  Enter a number between 0 and {rate.max}.
                </p>
              )}
              {msg && <p className="text-xs text-slate-500">{msg}</p>}
            </>
          ) : (
            <p className="text-xs text-slate-400">
              You have read-only access. Editing the XP rate requires the admin role.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
