import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { deathXpLossApi, type DeathXpLossUpdate } from "../lib/api";

export function DeathXpLossPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["death-xp-loss"],
    queryFn: () => deathXpLossApi.get(),
  });
  const setting = data?.setting;

  // Editable start level, synced from the server whenever it (re)loads. When
  // loss is disabled on the server we seed the field with the default start
  // level so enabling it offers a sensible value rather than the sentinel.
  const [startLevel, setStartLevel] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (setting) {
      setStartLevel(String(setting.enabled ? setting.startLevel : setting.defaultStartLevelForEnable));
    }
  }, [setting?.value]);

  const mutation = useMutation({
    mutationFn: (update: DeathXpLossUpdate) => deathXpLossApi.set(update),
    onSuccess: (res) => {
      setMsg(res.changed ? "Saved." : "No change — already set that way.");
      qc.setQueryData(["death-xp-loss"], res);
    },
    onError: (e) => setMsg((e as Error).message),
  });

  const parsedLevel = Number(startLevel.trim());
  const levelValid =
    startLevel.trim() !== "" &&
    Number.isInteger(parsedLevel) &&
    parsedLevel >= 1 &&
    (!setting || parsedLevel <= setting.maxPlayerLevel);

  function save(update: DeathXpLossUpdate) {
    setMsg(null);
    mutation.mutate(update);
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">XP loss on death</h1>
        <p className="mt-1 text-sm text-slate-500">
          Whether a PvE death costs the player experience. Backed by the{" "}
          <code className="font-mono">pve_exp_loss_level</code> property — the lowest character level
          at which death deducts XP. Disabling it raises that threshold above the maximum level, so no
          player ever loses XP on death.
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

      {setting && (
        <div className="space-y-5 rounded-lg border border-slate-200 p-5 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">XP loss on death</span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                setting.enabled
                  ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              }`}
            >
              {setting.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="flex items-baseline justify-between text-xs text-slate-400">
            <span>Current start level</span>
            <span className="font-mono">
              {setting.enabled ? setting.startLevel : `${setting.value} (off)`}
            </span>
          </div>

          {isAdmin ? (
            <div className="space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              {setting.enabled ? (
                <>
                  <div className="flex items-end gap-3">
                    <label className="flex-1">
                      <span className="mb-1 block text-xs font-medium text-slate-500">
                        Start losing XP at level (1–{setting.maxPlayerLevel})
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={setting.maxPlayerLevel}
                        step={1}
                        value={startLevel}
                        onChange={(e) => {
                          setStartLevel(e.target.value);
                          setMsg(null);
                        }}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                      />
                    </label>
                    <button
                      onClick={() => save({ enabled: true, startLevel: parsedLevel })}
                      disabled={!levelValid || parsedLevel === setting.startLevel || mutation.isPending}
                      className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-40"
                    >
                      {mutation.isPending ? "Saving…" : "Save level"}
                    </button>
                  </div>
                  {startLevel.trim() !== "" && !levelValid && (
                    <p className="text-xs text-red-600">
                      Enter a whole number between 1 and {setting.maxPlayerLevel}.
                    </p>
                  )}
                  <button
                    onClick={() => save({ enabled: false })}
                    disabled={mutation.isPending}
                    className="w-full rounded-md border border-emerald-400 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-40 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950"
                  >
                    Disable XP loss on death
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-500">
                    Players keep their experience when they die. Re-enable to restore the normal
                    penalty from a chosen level upward.
                  </p>
                  <div className="flex items-end gap-3">
                    <label className="flex-1">
                      <span className="mb-1 block text-xs font-medium text-slate-500">
                        Re-enable, starting at level (1–{setting.maxPlayerLevel})
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={setting.maxPlayerLevel}
                        step={1}
                        value={startLevel}
                        onChange={(e) => {
                          setStartLevel(e.target.value);
                          setMsg(null);
                        }}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                      />
                    </label>
                    <button
                      onClick={() => save({ enabled: true, startLevel: parsedLevel })}
                      disabled={!levelValid || mutation.isPending}
                      className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-40"
                    >
                      {mutation.isPending ? "Saving…" : "Enable XP loss"}
                    </button>
                  </div>
                  {startLevel.trim() !== "" && !levelValid && (
                    <p className="text-xs text-red-600">
                      Enter a whole number between 1 and {setting.maxPlayerLevel}.
                    </p>
                  )}
                </>
              )}

              <p className="text-xs text-slate-400">
                Server default: {setting.defaultEnabled ? `loss from level ${setting.defaultStartLevel}` : "no loss"}.
              </p>
              {msg && <p className="text-xs text-slate-500">{msg}</p>}
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              You have read-only access. Changing XP loss on death requires the admin role.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
