import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { questsApi, type QuestDetail } from "../lib/api";

export function QuestDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["quest", id],
    queryFn: () => questsApi.get(Number(id)),
  });

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>;
  if (!data) return null;

  const q = data.quest;
  const steps = buildSteps(q);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/quests" className="text-sm text-amber-600 hover:underline">
          ← Quests
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{q.name}</h1>
        <p className="text-sm text-slate-500">
          #{q.id} · levels {q.minLevel}–{q.maxLevel} · start: {q.startName || "—"} (region{" "}
          {q.startRegionID})
        </p>
      </div>

      <Card title="Overview">
        <Field label="Description" value={q.description} />
        <Field label="Accept text" value={q.acceptText} />
        <Field label="Source NPC" value={q.sourceName} />
        <Field label="Source text" value={q.sourceText} />
        <Field label="Finish text" value={q.finishText} />
      </Card>

      <section className="space-y-2">
        <h2 className="font-semibold">Steps ({steps.length})</h2>
        {steps.length === 0 ? (
          <p className="text-sm text-slate-400">No step data.</p>
        ) : (
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li
                key={i}
                className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-1 font-medium">
                  Step {i + 1}
                  {s.type && <span className="ml-2 text-xs text-slate-400">type {s.type}</span>}
                </div>
                {s.text && <p>{s.text}</p>}
                {s.target && (
                  <p className="text-slate-500">
                    Target: {s.target}
                    {s.targetText ? ` — ${s.targetText}` : ""}
                  </p>
                )}
                {s.advance && <p className="text-slate-500">Advance: {s.advance}</p>}
                {s.items && <p className="text-slate-500">Items: {s.items}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <Card title="Rewards">
        <Field label="Money" value={q.rewardMoney} />
        <Field label="XP" value={q.rewardXP} />
        <Field label="CL XP" value={q.rewardCLXP} />
        <Field label="Realm points" value={q.rewardRP} />
        <Field label="Bounty points" value={q.rewardBP} />
        <Field label="Collect item" value={q.collectItemTemplate} />
        <Field label="Max count" value={q.maxCount ? String(q.maxCount) : ""} />
        <Field label="Optional reward items" value={q.optionalRewardItemTemplates} />
        <Field label="Final reward items" value={q.finalRewardItemTemplates} />
      </Card>

      <Card title="Requirements & metadata">
        <Field label="Allowed classes" value={q.allowedClasses} />
        <Field label="Quest dependency" value={q.questDependency} />
        <Field label="Class type" value={q.classType} />
        <Field label="Start type" value={String(q.startType)} />
      </Card>

      <p className="text-xs text-slate-400">Read-only in this release.</p>
    </div>
  );
}

interface Step {
  type: string;
  text: string;
  target: string;
  targetText: string;
  advance: string;
  items: string;
}

/** DataQuest encodes multi-step quests as pipe-delimited parallel arrays. */
function buildSteps(q: QuestDetail): Step[] {
  const split = (v: string) => (v ? v.split("|") : []);
  const types = split(q.stepType);
  const texts = split(q.stepText);
  const targets = split(q.targetName);
  const targetTexts = split(q.targetText);
  const advances = split(q.advanceText);
  const items = split(q.stepItemTemplates);
  const count = Math.max(
    types.length,
    texts.length,
    targets.length,
    targetTexts.length,
    advances.length,
    items.length,
  );
  const steps: Step[] = [];
  for (let i = 0; i < count; i += 1) {
    steps.push({
      type: types[i] ?? "",
      text: texts[i] ?? "",
      target: targets[i] ?? "",
      targetText: targetTexts[i] ?? "",
      advance: advances[i] ?? "",
      items: items[i] ?? "",
    });
  }
  return steps;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <dl className="space-y-2 text-sm">{children}</dl>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="whitespace-pre-wrap break-words">{value}</dd>
    </div>
  );
}
