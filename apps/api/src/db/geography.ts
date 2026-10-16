import type { RowDataPacket } from "mysql2";
import { gameDb } from "./gameDb.js";
import type { Sql } from "./accounts.js";

// --- Regions ---------------------------------------------------------------

export interface RegionSummary {
  regionID: number;
  name: string;
  expansion: number;
  isFrontier: boolean;
  housingEnabled: boolean;
}

export interface ZoneRef {
  zoneID: number;
  name: string;
}

export interface RegionDetail extends RegionSummary {
  description: string;
  ip: string;
  port: number;
  divingEnabled: boolean;
  waterLevel: number;
  classType: string;
  zones: ZoneRef[];
}

const REGION_SUMMARY = "RegionID, Name, Expansion, IsFrontier, HousingEnabled";
const REGION_DETAIL =
  REGION_SUMMARY + ", Description, IP, Port, DivingEnabled, WaterLevel, ClassType";

export function buildSearchRegionsQuery(params: { q?: string; limit: number; offset: number }): Sql {
  const { q, limit, offset } = params;
  if (q && q.trim().length > 0) {
    const like = `%${q.trim()}%`;
    return {
      text:
        `SELECT ${REGION_SUMMARY} FROM Regions WHERE Name LIKE ? OR RegionID = ? ` +
        `ORDER BY RegionID ASC LIMIT ? OFFSET ?`,
      values: [like, Number(q.trim()) || -1, limit, offset],
    };
  }
  return {
    text: `SELECT ${REGION_SUMMARY} FROM Regions ORDER BY RegionID ASC LIMIT ? OFFSET ?`,
    values: [limit, offset],
  };
}

export function buildGetRegionQuery(regionID: number): Sql {
  return { text: `SELECT ${REGION_DETAIL} FROM Regions WHERE RegionID = ? LIMIT 1`, values: [regionID] };
}

export function buildZonesForRegionQuery(regionID: number): Sql {
  return {
    text: `SELECT ZoneID, Name FROM Zones WHERE RegionID = ? ORDER BY ZoneID ASC`,
    values: [regionID],
  };
}

// --- Zones -----------------------------------------------------------------

export interface ZoneSummary {
  zoneID: number;
  regionID: number;
  name: string;
  realm: number;
  width: number;
  height: number;
}

export interface ZoneDetail extends ZoneSummary {
  isLava: boolean;
  divingFlag: number;
  waterLevel: number;
  offsetX: number;
  offsetY: number;
  experience: number;
  realmpoints: number;
  bountypoints: number;
  coin: number;
}

const ZONE_SUMMARY = "ZoneID, RegionID, Name, Realm, Width, Height";
const ZONE_DETAIL =
  ZONE_SUMMARY +
  ", IsLava, DivingFlag, WaterLevel, OffsetX, OffsetY, Experience, Realmpoints, Bountypoints, Coin";

export function buildSearchZonesQuery(params: { q?: string; limit: number; offset: number }): Sql {
  const { q, limit, offset } = params;
  if (q && q.trim().length > 0) {
    const like = `%${q.trim()}%`;
    return {
      text:
        `SELECT ${ZONE_SUMMARY} FROM Zones WHERE Name LIKE ? OR ZoneID = ? ` +
        `ORDER BY ZoneID ASC LIMIT ? OFFSET ?`,
      values: [like, Number(q.trim()) || -1, limit, offset],
    };
  }
  return {
    text: `SELECT ${ZONE_SUMMARY} FROM Zones ORDER BY ZoneID ASC LIMIT ? OFFSET ?`,
    values: [limit, offset],
  };
}

export function buildGetZoneQuery(zoneID: number): Sql {
  return { text: `SELECT ${ZONE_DETAIL} FROM Zones WHERE ZoneID = ? LIMIT 1`, values: [zoneID] };
}

// --- Teleports -------------------------------------------------------------

export interface Teleport {
  type: string;
  teleportID: string;
  realm: number;
  regionID: number;
  x: number;
  y: number;
  z: number;
  heading: number;
}

export function buildSearchTeleportsQuery(params: {
  q?: string;
  limit: number;
  offset: number;
}): Sql {
  const { q, limit, offset } = params;
  const cols = "Type, TeleportID, Realm, RegionID, X, Y, Z, Heading";
  if (q && q.trim().length > 0) {
    const like = `%${q.trim()}%`;
    return {
      text:
        `SELECT ${cols} FROM Teleport WHERE TeleportID LIKE ? OR Type LIKE ? ` +
        `ORDER BY TeleportID ASC LIMIT ? OFFSET ?`,
      values: [like, like, limit, offset],
    };
  }
  return {
    text: `SELECT ${cols} FROM Teleport ORDER BY TeleportID ASC LIMIT ? OFFSET ?`,
    values: [limit, offset],
  };
}

// --- Executors -------------------------------------------------------------

const n = (v: unknown): number => Number(v ?? 0);
const b = (v: unknown): boolean => Boolean(v);
const s = (v: unknown): string => (v == null ? "" : String(v));

interface AnyRow extends RowDataPacket {
  [key: string]: unknown;
}

function regionSummary(r: AnyRow): RegionSummary {
  return {
    regionID: n(r.RegionID),
    name: s(r.Name),
    expansion: n(r.Expansion),
    isFrontier: b(r.IsFrontier),
    housingEnabled: b(r.HousingEnabled),
  };
}

export async function searchRegions(params: {
  q?: string;
  limit: number;
  offset: number;
}): Promise<RegionSummary[]> {
  const { text, values } = buildSearchRegionsQuery(params);
  const [rows] = await gameDb.query<AnyRow[]>(text, values);
  return rows.map(regionSummary);
}

export async function getRegion(regionID: number): Promise<RegionDetail | null> {
  const q = buildGetRegionQuery(regionID);
  const zq = buildZonesForRegionQuery(regionID);
  const [[rows], [zoneRows]] = await Promise.all([
    gameDb.query<AnyRow[]>(q.text, q.values),
    gameDb.query<AnyRow[]>(zq.text, zq.values),
  ]);
  const r = rows[0];
  if (!r) return null;
  return {
    ...regionSummary(r),
    description: s(r.Description),
    ip: s(r.IP),
    port: n(r.Port),
    divingEnabled: b(r.DivingEnabled),
    waterLevel: n(r.WaterLevel),
    classType: s(r.ClassType),
    zones: zoneRows.map((z) => ({ zoneID: n(z.ZoneID), name: s(z.Name) })),
  };
}

function zoneSummary(r: AnyRow): ZoneSummary {
  return {
    zoneID: n(r.ZoneID),
    regionID: n(r.RegionID),
    name: s(r.Name),
    realm: n(r.Realm),
    width: n(r.Width),
    height: n(r.Height),
  };
}

export async function searchZones(params: {
  q?: string;
  limit: number;
  offset: number;
}): Promise<ZoneSummary[]> {
  const { text, values } = buildSearchZonesQuery(params);
  const [rows] = await gameDb.query<AnyRow[]>(text, values);
  return rows.map(zoneSummary);
}

export async function getZone(zoneID: number): Promise<ZoneDetail | null> {
  const { text, values } = buildGetZoneQuery(zoneID);
  const [rows] = await gameDb.query<AnyRow[]>(text, values);
  const r = rows[0];
  if (!r) return null;
  return {
    ...zoneSummary(r),
    isLava: b(r.IsLava),
    divingFlag: n(r.DivingFlag),
    waterLevel: n(r.WaterLevel),
    offsetX: n(r.OffsetX),
    offsetY: n(r.OffsetY),
    experience: n(r.Experience),
    realmpoints: n(r.Realmpoints),
    bountypoints: n(r.Bountypoints),
    coin: n(r.Coin),
  };
}

export async function searchTeleports(params: {
  q?: string;
  limit: number;
  offset: number;
}): Promise<Teleport[]> {
  const { text, values } = buildSearchTeleportsQuery(params);
  const [rows] = await gameDb.query<AnyRow[]>(text, values);
  return rows.map((r) => ({
    type: s(r.Type),
    teleportID: s(r.TeleportID),
    realm: n(r.Realm),
    regionID: n(r.RegionID),
    x: n(r.X),
    y: n(r.Y),
    z: n(r.Z),
    heading: n(r.Heading),
  }));
}
