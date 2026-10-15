import type { RowDataPacket } from "mysql2";
import { gameDb } from "./gameDb.js";
import type { Sql } from "./accounts.js";

export interface SpellSummary {
  spellID: number;
  name: string;
  type: string;
  target: string;
  damage: number;
  damageType: number;
  range: number;
  power: number;
  castTime: number;
}

export interface SpellDetail extends SpellSummary {
  description: string;
  clientEffect: number;
  icon: number;
  tooltipId: number;
  radius: number;
  duration: number;
  frequency: number;
  pulse: number;
  pulsePower: number;
  concentration: number;
  recastDelay: number;
  uninterruptible: boolean;
  moveCast: boolean;
  instrumentRequirement: number;
  value: number;
  lifeDrainReturn: number;
  amnesiaChance: number;
  resurrectHealth: number;
  resurrectMana: number;
  spellGroup: number;
  effectGroup: number;
  subSpellID: number;
  sharedTimerGroup: number;
  isPrimary: boolean;
  isSecondary: boolean;
  isFocus: boolean;
  allowBolt: boolean;
  message1: string;
  message2: string;
  message3: string;
  message4: string;
  packageID: string;
}

const SUMMARY_COLUMNS =
  "SpellID, Name, Type, Target, Damage, DamageType, `Range`, Power, CastTime";
const DETAIL_COLUMNS =
  SUMMARY_COLUMNS +
  ", Description, ClientEffect, Icon, TooltipId, Radius, Duration, Frequency, Pulse, PulsePower, " +
  "Concentration, RecastDelay, Uninterruptible, MoveCast, InstrumentRequirement, Value, " +
  "LifeDrainReturn, AmnesiaChance, ResurrectHealth, ResurrectMana, SpellGroup, EffectGroup, " +
  "SubSpellID, SharedTimerGroup, IsPrimary, IsSecondary, IsFocus, AllowBolt, " +
  "Message1, Message2, Message3, Message4, PackageID";

export function buildSearchSpellsQuery(params: {
  q?: string;
  limit: number;
  offset: number;
}): Sql {
  const { q, limit, offset } = params;
  if (q && q.trim().length > 0) {
    const like = `%${q.trim()}%`;
    return {
      text:
        `SELECT ${SUMMARY_COLUMNS} FROM Spell WHERE Name LIKE ? OR SpellID = ? ` +
        `ORDER BY Name ASC LIMIT ? OFFSET ?`,
      values: [like, Number(q.trim()) || -1, limit, offset],
    };
  }
  return {
    text: `SELECT ${SUMMARY_COLUMNS} FROM Spell ORDER BY Name ASC LIMIT ? OFFSET ?`,
    values: [limit, offset],
  };
}

export function buildGetSpellQuery(spellID: number): Sql {
  return { text: `SELECT ${DETAIL_COLUMNS} FROM Spell WHERE SpellID = ? LIMIT 1`, values: [spellID] };
}

interface SpellRow extends RowDataPacket {
  [key: string]: unknown;
}

const n = (v: unknown): number => Number(v ?? 0);
const b = (v: unknown): boolean => Boolean(v);
const s = (v: unknown): string => (v == null ? "" : String(v));

function toSummary(r: SpellRow): SpellSummary {
  return {
    spellID: n(r.SpellID),
    name: s(r.Name),
    type: s(r.Type),
    target: s(r.Target),
    damage: n(r.Damage),
    damageType: n(r.DamageType),
    range: n(r.Range),
    power: n(r.Power),
    castTime: n(r.CastTime),
  };
}

export async function searchSpells(params: {
  q?: string;
  limit: number;
  offset: number;
}): Promise<SpellSummary[]> {
  const { text, values } = buildSearchSpellsQuery(params);
  const [rows] = await gameDb.query<SpellRow[]>(text, values);
  return rows.map(toSummary);
}

export async function getSpell(spellID: number): Promise<SpellDetail | null> {
  const { text, values } = buildGetSpellQuery(spellID);
  const [rows] = await gameDb.query<SpellRow[]>(text, values);
  const r = rows[0];
  if (!r) return null;
  return {
    ...toSummary(r),
    description: s(r.Description),
    clientEffect: n(r.ClientEffect),
    icon: n(r.Icon),
    tooltipId: n(r.TooltipId),
    radius: n(r.Radius),
    duration: n(r.Duration),
    frequency: n(r.Frequency),
    pulse: n(r.Pulse),
    pulsePower: n(r.PulsePower),
    concentration: n(r.Concentration),
    recastDelay: n(r.RecastDelay),
    uninterruptible: b(r.Uninterruptible),
    moveCast: b(r.MoveCast),
    instrumentRequirement: n(r.InstrumentRequirement),
    value: n(r.Value),
    lifeDrainReturn: n(r.LifeDrainReturn),
    amnesiaChance: n(r.AmnesiaChance),
    resurrectHealth: n(r.ResurrectHealth),
    resurrectMana: n(r.ResurrectMana),
    spellGroup: n(r.SpellGroup),
    effectGroup: n(r.EffectGroup),
    subSpellID: n(r.SubSpellID),
    sharedTimerGroup: n(r.SharedTimerGroup),
    isPrimary: b(r.IsPrimary),
    isSecondary: b(r.IsSecondary),
    isFocus: b(r.IsFocus),
    allowBolt: b(r.AllowBolt),
    message1: s(r.Message1),
    message2: s(r.Message2),
    message3: s(r.Message3),
    message4: s(r.Message4),
    packageID: s(r.PackageID),
  };
}
