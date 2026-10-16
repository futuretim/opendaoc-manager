import type { RowDataPacket } from "mysql2";
import { gameDb } from "./gameDb.js";
import type { Sql } from "./accounts.js";

export interface QuestSummary {
  id: number;
  name: string;
  minLevel: number;
  maxLevel: number;
  startRegionID: number;
  startName: string;
}

export interface QuestDetail extends QuestSummary {
  startType: number;
  acceptText: string;
  description: string;
  sourceName: string;
  sourceText: string;
  stepType: string;
  stepText: string;
  stepItemTemplates: string;
  advanceText: string;
  targetName: string;
  targetText: string;
  collectItemTemplate: string;
  maxCount: number;
  rewardMoney: string;
  rewardXP: string;
  rewardCLXP: string;
  rewardRP: string;
  rewardBP: string;
  optionalRewardItemTemplates: string;
  finalRewardItemTemplates: string;
  finishText: string;
  questDependency: string;
  allowedClasses: string;
  classType: string;
}

const SUMMARY_COLUMNS = "ID, Name, MinLevel, MaxLevel, StartRegionID, StartName";
const DETAIL_COLUMNS =
  "ID, Name, MinLevel, MaxLevel, StartRegionID, StartName, StartType, AcceptText, Description, " +
  "SourceName, SourceText, StepType, StepText, StepItemTemplates, AdvanceText, TargetName, TargetText, " +
  "CollectItemTemplate, MaxCount, RewardMoney, RewardXP, RewardCLXP, RewardRP, RewardBP, " +
  "OptionalRewardItemTemplates, FinalRewardItemTemplates, FinishText, QuestDependency, AllowedClasses, ClassType";

export function buildSearchQuestsQuery(params: {
  q?: string;
  limit: number;
  offset: number;
}): Sql {
  const { q, limit, offset } = params;
  if (q && q.trim().length > 0) {
    const like = `%${q.trim()}%`;
    return {
      text:
        `SELECT ${SUMMARY_COLUMNS} FROM DataQuest ` +
        `WHERE Name LIKE ? OR StartName LIKE ? ` +
        `ORDER BY Name ASC LIMIT ? OFFSET ?`,
      values: [like, like, limit, offset],
    };
  }
  return {
    text: `SELECT ${SUMMARY_COLUMNS} FROM DataQuest ORDER BY Name ASC LIMIT ? OFFSET ?`,
    values: [limit, offset],
  };
}

export function buildGetQuestQuery(id: number): Sql {
  return { text: `SELECT ${DETAIL_COLUMNS} FROM DataQuest WHERE ID = ? LIMIT 1`, values: [id] };
}

interface QuestRow extends RowDataPacket {
  ID: number;
  Name: string;
  MinLevel: number;
  MaxLevel: number;
  StartRegionID: number;
  StartName: string;
  [key: string]: unknown;
}

function toSummary(r: QuestRow): QuestSummary {
  return {
    id: Number(r.ID),
    name: r.Name,
    minLevel: Number(r.MinLevel),
    maxLevel: Number(r.MaxLevel),
    startRegionID: Number(r.StartRegionID),
    startName: r.StartName,
  };
}

export async function searchQuests(params: {
  q?: string;
  limit: number;
  offset: number;
}): Promise<QuestSummary[]> {
  const { text, values } = buildSearchQuestsQuery(params);
  const [rows] = await gameDb.query<QuestRow[]>(text, values);
  return rows.map(toSummary);
}

export async function getQuest(id: number): Promise<QuestDetail | null> {
  const { text, values } = buildGetQuestQuery(id);
  const [rows] = await gameDb.query<QuestRow[]>(text, values);
  const r = rows[0];
  if (!r) return null;
  const s = (v: unknown): string => (v == null ? "" : String(v));
  return {
    ...toSummary(r),
    startType: Number(r.StartType ?? 0),
    acceptText: s(r.AcceptText),
    description: s(r.Description),
    sourceName: s(r.SourceName),
    sourceText: s(r.SourceText),
    stepType: s(r.StepType),
    stepText: s(r.StepText),
    stepItemTemplates: s(r.StepItemTemplates),
    advanceText: s(r.AdvanceText),
    targetName: s(r.TargetName),
    targetText: s(r.TargetText),
    collectItemTemplate: s(r.CollectItemTemplate),
    maxCount: Number(r.MaxCount ?? 0),
    rewardMoney: s(r.RewardMoney),
    rewardXP: s(r.RewardXP),
    rewardCLXP: s(r.RewardCLXP),
    rewardRP: s(r.RewardRP),
    rewardBP: s(r.RewardBP),
    optionalRewardItemTemplates: s(r.OptionalRewardItemTemplates),
    finalRewardItemTemplates: s(r.FinalRewardItemTemplates),
    finishText: s(r.FinishText),
    questDependency: s(r.QuestDependency),
    allowedClasses: s(r.AllowedClasses),
    classType: s(r.ClassType),
  };
}
