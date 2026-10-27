const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Thin fetch wrapper for the Manager API. Always sends cookies (the session)
 * and normalizes the API's `{ error: { code, message } }` envelope into an
 * ApiError.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const code = body?.error?.code ?? "error";
    const message = body?.error?.message ?? res.statusText;
    throw new ApiError(res.status, code, message);
  }

  return body as T;
}

export interface AuthUser {
  id: number;
  email: string;
  role: "admin" | "gm";
}

export const authApi = {
  me: () => apiFetch<{ user: AuthUser }>("/auth/me"),
  login: (email: string, password: string) =>
    apiFetch<{ user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => apiFetch<{ ok: true }>("/auth/logout", { method: "POST" }),
};

// --- Accounts --------------------------------------------------------------

export interface AccountSummary {
  name: string;
  privLevel: number;
  realm: number;
  creationDate: string | null;
  lastLogin: string | null;
  discordId: string | null;
}

export interface AccountDetail extends AccountSummary {
  status: number;
  isMuted: boolean;
  isWarned: boolean;
  isTester: boolean;
  notes: string | null;
  mail: string | null;
  lastLoginIP: string | null;
  lastClientVersion: string | null;
}

export interface AccountUpdate {
  privLevel?: number;
  status?: number;
  isMuted?: boolean;
  isWarned?: boolean;
  isTester?: boolean;
  notes?: string | null;
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const accountsApi = {
  search: (query: string, page = 1) =>
    apiFetch<{ items: AccountSummary[]; page: number; pageSize: number }>(
      `/accounts${qs({ query, page })}`,
    ),
  get: (name: string) =>
    apiFetch<{ account: AccountDetail; characters: CharacterSummary[]; bans: Ban[] }>(
      `/accounts/${encodeURIComponent(name)}`,
    ),
  resetPassword: (name: string, password: string) =>
    apiFetch<{ ok: true }>(`/accounts/${encodeURIComponent(name)}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  update: (name: string, updates: AccountUpdate) =>
    apiFetch<{ account: AccountDetail }>(`/accounts/${encodeURIComponent(name)}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),
  rename: (name: string, newName: string) =>
    apiFetch<{ account: AccountDetail; cascades: { table: string; column: string; updated: number }[] }>(
      `/accounts/${encodeURIComponent(name)}/rename`,
      { method: "POST", body: JSON.stringify({ newName }) },
    ),
};

// --- Characters ------------------------------------------------------------

export interface CharacterSummary {
  name: string;
  accountName: string;
  level: number;
  class: number;
  race: number;
  realm: number;
  lastPlayed: string | null;
}

export interface CharacterDetail extends CharacterSummary {
  accountSlot: number;
  realmLevel: number;
  realmPoints: number;
  bountyPoints: number;
  strength: number;
  dexterity: number;
  constitution: number;
  quickness: number;
  intelligence: number;
  piety: number;
  empathy: number;
  charisma: number;
  health: number;
  mana: number;
  endurance: number;
  copper: number;
  silver: number;
  gold: number;
  platinum: number;
  mithril: number;
  guildId: string | null;
  guildName: string | null;
  guildRank: number;
}

export interface CharacterUpdate {
  level?: number;
  realmLevel?: number;
  realmPoints?: number;
  bountyPoints?: number;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  quickness?: number;
  intelligence?: number;
  piety?: number;
  empathy?: number;
  charisma?: number;
  health?: number;
  mana?: number;
  endurance?: number;
  copper?: number;
  silver?: number;
  gold?: number;
  platinum?: number;
  mithril?: number;
}

export const charactersApi = {
  search: (query: string, realm: number | undefined, page = 1) =>
    apiFetch<{ items: CharacterSummary[]; page: number; pageSize: number }>(
      `/characters${qs({ query, realm, page })}`,
    ),
  get: (name: string) =>
    apiFetch<{ character: CharacterDetail }>(`/characters/${encodeURIComponent(name)}`),
  update: (name: string, updates: CharacterUpdate) =>
    apiFetch<{ character: CharacterDetail }>(`/characters/${encodeURIComponent(name)}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),
  rename: (name: string, newName: string) =>
    apiFetch<{ character: CharacterDetail }>(`/characters/${encodeURIComponent(name)}/rename`, {
      method: "POST",
      body: JSON.stringify({ newName }),
    }),
  move: (name: string, toAccount: string) =>
    apiFetch<{ character: CharacterDetail; slot: number }>(
      `/characters/${encodeURIComponent(name)}/move`,
      { method: "POST", body: JSON.stringify({ toAccount }) },
    ),
};

// --- Inventory -------------------------------------------------------------

export type InventoryScope = "character" | "guild" | "account";

export interface InventoryItem {
  inventoryId: string;
  ownerId: string;
  slotPosition: number;
  count: number;
  itemTemplateId: string | null;
  itemUniqueId: string | null;
  name: string;
  level: number;
  quality: number;
  objectType: number;
  itemType: number;
  dpsAf: number;
  spdAbs: number;
  weight: number;
  model: number;
  color: number;
  emblem: number;
  condition: number;
  durability: number;
  maxCondition: number;
  maxDurability: number;
  isStackable: boolean;
  maxCount: number;
  price: number;
  sellPrice: number;
  isCrafted: boolean;
  creator: string | null;
  charges: number;
  maxCharges: number;
  description: string;
  realm: number;
}

export interface InventoryListResponse {
  scope: InventoryScope;
  ownerId: string;
  guildName?: string;
  accountName?: string;
  items: InventoryItem[];
}

export interface InventoryItemUpdate {
  slotPosition?: number;
  count?: number;
  sellPrice?: number;
  color?: number;
  emblem?: number;
  condition?: number;
  durability?: number;
  charges?: number;
}

export interface InventoryGrant {
  scope: InventoryScope;
  itemTemplateId: string;
  slotPosition: number;
  count?: number;
  sellPrice?: number;
}

export interface CharacterGuildInfo {
  guild: {
    guildId: string;
    guildName: string | null;
    realm: number;
    guildLevel: number;
    guildRank: number;
  } | null;
}

export const inventoryApi = {
  list: (characterName: string, scope: InventoryScope) =>
    apiFetch<InventoryListResponse>(
      `/characters/${encodeURIComponent(characterName)}/inventory${qs({ scope })}`,
    ),
  get: (inventoryId: string) =>
    apiFetch<{ item: InventoryItem }>(`/inventory/${encodeURIComponent(inventoryId)}`),
  update: (inventoryId: string, updates: InventoryItemUpdate) =>
    apiFetch<{ item: InventoryItem }>(`/inventory/${encodeURIComponent(inventoryId)}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),
  remove: (inventoryId: string) =>
    apiFetch<{ ok: true }>(`/inventory/${encodeURIComponent(inventoryId)}`, { method: "DELETE" }),
  grant: (characterName: string, grant: InventoryGrant) =>
    apiFetch<{ item: InventoryItem }>(`/characters/${encodeURIComponent(characterName)}/inventory/grant`, {
      method: "POST",
      body: JSON.stringify(grant),
    }),
  guildInfo: (characterName: string) =>
    apiFetch<CharacterGuildInfo>(`/characters/${encodeURIComponent(characterName)}/guild`),
  accountVaultInfo: (characterName: string) =>
    apiFetch<{ accountName: string; realm: number; ownerId: string; vaultCount: number; vaultSize: number }>(
      `/characters/${encodeURIComponent(characterName)}/account-vault-info`,
    ),
};

// --- Bans ------------------------------------------------------------------

export type BanType = "A" | "I" | "B";

export interface Ban {
  id: string;
  author: string;
  type: BanType;
  ip: string;
  account: string;
  dateBan: string | null;
  reason: string;
}

export interface BanCreate {
  type: BanType;
  account?: string;
  ip?: string;
  reason: string;
}

export const bansApi = {
  list: (type: BanType | "" = "", page = 1) =>
    apiFetch<{ items: Ban[]; page: number; pageSize: number }>(
      `/bans${qs({ type: type || undefined, page })}`,
    ),
  create: (ban: BanCreate) =>
    apiFetch<{ ban: Ban }>("/bans", { method: "POST", body: JSON.stringify(ban) }),
  lift: (id: string) =>
    apiFetch<{ ok: true }>(`/bans/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

/** Human-readable realm names (DAoC). */
export const REALM_NAMES: Record<number, string> = {
  0: "None",
  1: "Albion",
  2: "Midgard",
  3: "Hibernia",
};

export const PRIV_LEVEL_NAMES: Record<number, string> = {
  1: "Player",
  2: "GM",
  3: "Admin",
};

/** DAoC race ids (OpenDAoC eRace). */
export const RACE_NAMES: Record<number, string> = {
  0: "Unknown",
  1: "Briton",
  2: "Avalonian",
  3: "Highlander",
  4: "Saracen",
  5: "Norseman",
  6: "Troll",
  7: "Dwarf",
  8: "Kobold",
  9: "Celt",
  10: "Firbolg",
  11: "Elf",
  12: "Lurikeen",
  13: "Inconnu",
  14: "Valkyn",
  15: "Sylvan",
  16: "Half Ogre",
  17: "Frostalf",
  18: "Shar",
  19: "Minotaur",
  20: "Minotaur",
  21: "Minotaur",
};

/** DAoC class ids (OpenDAoC eCharacterClass). */
export const CLASS_NAMES: Record<number, string> = {
  0: "Unknown",
  1: "Paladin",
  2: "Armsman",
  3: "Scout",
  4: "Minstrel",
  5: "Theurgist",
  6: "Cleric",
  7: "Wizard",
  8: "Sorcerer",
  9: "Infiltrator",
  10: "Friar",
  11: "Mercenary",
  12: "Necromancer",
  13: "Cabalist",
  14: "Fighter",
  15: "Elementalist",
  16: "Acolyte",
  17: "Albion Rogue",
  18: "Mage",
  19: "Reaver",
  20: "Disciple",
  21: "Thane",
  22: "Warrior",
  23: "Shadowblade",
  24: "Skald",
  25: "Hunter",
  26: "Healer",
  27: "Spiritmaster",
  28: "Shaman",
  29: "Runemaster",
  30: "Bonedancer",
  31: "Berserker",
  32: "Savage",
  33: "Heretic",
  34: "Valkyrie",
  35: "Viking",
  36: "Mystic",
  37: "Seer",
  38: "Midgard Rogue",
  39: "Bainshee",
  40: "Eldritch",
  41: "Enchanter",
  42: "Mentalist",
  43: "Blademaster",
  44: "Hero",
  45: "Champion",
  46: "Warden",
  47: "Druid",
  48: "Bard",
  49: "Nightshade",
  50: "Ranger",
  51: "Magician",
  52: "Guardian",
  53: "Naturalist",
  54: "Stalker",
  55: "Animist",
  56: "Valewalker",
  57: "Forester",
  58: "Vampiir",
  59: "Warlock",
  60: "Mauler (Alb)",
  61: "Mauler (Mid)",
  62: "Mauler (Hib)",
};

export const className = (id: number): string => CLASS_NAMES[id] ?? `Class ${id}`;
export const raceName = (id: number): string => RACE_NAMES[id] ?? `Race ${id}`;

// --- Staff (admin-only) ----------------------------------------------------

export interface StaffUser {
  id: number;
  email: string;
  role: "admin" | "gm";
  isActive: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
}

export const staffApi = {
  list: () => apiFetch<{ items: StaffUser[] }>("/staff"),
  create: (email: string, password: string, role: "admin" | "gm") =>
    apiFetch<{ user: StaffUser }>("/staff", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    }),
  update: (id: number, updates: { role?: "admin" | "gm"; isActive?: boolean }) =>
    apiFetch<{ user: StaffUser }>(`/staff/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),
};

// --- Audit log (admin-only) ------------------------------------------------

export interface AuditEntry {
  id: number;
  actorUserId: number | null;
  actorEmail: string | null;
  action: string;
  target: string | null;
  metadata: unknown | null;
  ip: string | null;
  createdAt: string | null;
}

export const auditApi = {
  list: (params: { action?: string; page?: number } = {}) =>
    apiFetch<{ items: AuditEntry[]; page: number; pageSize: number }>(
      `/audit${qs({ action: params.action, page: params.page })}`,
    ),
};

// --- Quests (DataQuest, read-only) -----------------------------------------

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

export const questsApi = {
  search: (query: string, page = 1) =>
    apiFetch<{ items: QuestSummary[]; page: number; pageSize: number }>(
      `/quests${qs({ query, page })}`,
    ),
  get: (id: number) => apiFetch<{ quest: QuestDetail }>(`/quests/${id}`),
};

// --- Items (ItemTemplate, read-only) ---------------------------------------

export interface ItemSummary {
  idNb: string;
  name: string;
  level: number;
  realm: number;
  objectType: number;
  itemType: number;
  quality: number;
  dpsAf: number;
  spdAbs: number;
}

export interface ItemDetail extends ItemSummary {
  description: string;
  model: number;
  weight: number;
  hand: number;
  typeDamage: number;
  bonus: number;
  bonusLevel: number;
  extraBonus: number;
  extraBonusType: number;
  durability: number;
  maxDurability: number;
  condition: number;
  maxCondition: number;
  isIndestructible: boolean;
  isNotLosingDur: boolean;
  isPickable: boolean;
  isDropable: boolean;
  canDropAsLoot: boolean;
  isTradable: boolean;
  isStackable: boolean;
  maxCount: number;
  packSize: number;
  price: number;
  levelRequirement: number;
  allowedClasses: string;
  flags: number;
  color: number;
  emblem: number;
  effect: number;
  charges: number;
  maxCharges: number;
  charges1: number;
  maxCharges1: number;
  canUseEvery: number;
  poisonSpellID: number;
  poisonCharges: number;
  poisonMaxCharges: number;
  packageID: string;
  classType: string;
  salvageYieldID: number;
}

export const itemsApi = {
  search: (query: string, page = 1) =>
    apiFetch<{ items: ItemSummary[]; page: number; pageSize: number }>(
      `/items${qs({ query, page })}`,
    ),
  get: (idNb: string) => apiFetch<{ item: ItemDetail }>(`/items/${encodeURIComponent(idNb)}`),
};

// --- Mobs & NPC templates (read-only) --------------------------------------

export interface MobSummary {
  id: string;
  name: string;
  level: number;
  realm: number;
  region: number;
  x: number;
  y: number;
  z: number;
  npcTemplateID: number;
}

export interface MobDetail extends MobSummary {
  suffix: string;
  guild: string;
  model: number;
  size: number;
  speed: number;
  heading: number;
  strength: number;
  constitution: number;
  dexterity: number;
  quickness: number;
  intelligence: number;
  piety: number;
  empathy: number;
  charisma: number;
  race: number;
  gender: number;
  flags: number;
  aggroLevel: number;
  aggroRange: number;
  meleeDamageType: number;
  respawnInterval: number;
  roamingRange: number;
  factionID: number;
  bodyType: number;
  houseNumber: number;
  brain: string;
  pathID: string;
  ownerID: string;
  equipmentTemplateID: string;
  itemsListTemplateID: string;
  visibleWeaponSlots: number;
  isCloakHoodUp: boolean;
  packageID: string;
  classType: string;
}

export interface NpcTemplateSummary {
  templateId: number;
  name: string;
  level: string;
  model: string;
  race: number;
  classType: string;
}

export interface NpcTemplateDetail extends NpcTemplateSummary {
  suffix: string;
  guildName: string;
  size: string;
  maxSpeed: number;
  factionID: number;
  gender: number;
  flags: number;
  meleeDamageType: number;
  parryChance: number;
  evadeChance: number;
  blockChance: number;
  leftHandSwingChance: number;
  spells: string;
  styles: string;
  abilities: string;
  strength: number;
  constitution: number;
  dexterity: number;
  quickness: number;
  intelligence: number;
  piety: number;
  charisma: number;
  empathy: number;
  aggroLevel: number;
  aggroRange: number;
  bodyType: number;
  maxDistance: number;
  tetherRange: number;
  visibleWeaponSlots: number;
  replaceMobValues: boolean;
  equipmentTemplateID: string;
  itemsListTemplateID: string;
  packageID: string;
}

export const mobsApi = {
  search: (query: string, page = 1) =>
    apiFetch<{ items: MobSummary[]; page: number; pageSize: number }>(`/mobs${qs({ query, page })}`),
  get: (id: string) => apiFetch<{ mob: MobDetail }>(`/mobs/${encodeURIComponent(id)}`),
};

export const npcTemplatesApi = {
  search: (query: string, page = 1) =>
    apiFetch<{ items: NpcTemplateSummary[]; page: number; pageSize: number }>(
      `/npc-templates${qs({ query, page })}`,
    ),
  get: (templateId: number) =>
    apiFetch<{ template: NpcTemplateDetail }>(`/npc-templates/${templateId}`),
};

// --- Loot & merchants (read-only) ------------------------------------------

export interface LootTemplateSummary {
  name: string;
  entries: number;
}
export interface LootEntry {
  itemTemplateID: string;
  itemName: string | null;
  chance: number;
  count: number;
}
export interface LootMobRef {
  mobName: string;
  dropCount: number;
}
export interface LootTemplateDetail {
  name: string;
  entries: LootEntry[];
  mobs: LootMobRef[];
}

export interface MerchantListSummary {
  id: string;
  entries: number;
}
export interface MerchantEntry {
  itemTemplateID: string;
  itemName: string | null;
  pageNumber: number;
  slotPosition: number;
}
export interface MerchantListDetail {
  id: string;
  entries: MerchantEntry[];
}

export const lootApi = {
  search: (query: string, page = 1) =>
    apiFetch<{ items: LootTemplateSummary[]; page: number; pageSize: number }>(
      `/loot-templates${qs({ query, page })}`,
    ),
  get: (name: string) =>
    apiFetch<{ template: LootTemplateDetail }>(`/loot-templates/${encodeURIComponent(name)}`),
};

export const merchantsApi = {
  search: (query: string, page = 1) =>
    apiFetch<{ items: MerchantListSummary[]; page: number; pageSize: number }>(
      `/merchant-lists${qs({ query, page })}`,
    ),
  get: (id: string) =>
    apiFetch<{ list: MerchantListDetail }>(`/merchant-lists/${encodeURIComponent(id)}`),
};

// --- Spells & styles (read-only) -------------------------------------------

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

export interface StyleSummary {
  styleID: number;
  name: string;
  classId: number;
  specKeyName: string;
  specLevelRequirement: number;
}

export interface StyleDetail extends StyleSummary {
  icon: number;
  enduranceCost: number;
  stealthRequirement: boolean;
  openingRequirementType: number;
  openingRequirementValue: number;
  attackResultRequirement: number;
  weaponTypeRequirement: number;
  growthOffset: number;
  growthRate: number;
  bonusToHit: number;
  bonusToDefense: number;
  twoHandAnimation: number;
  randomProc: boolean;
  armorHitLocation: number;
}

export const spellsApi = {
  search: (query: string, page = 1) =>
    apiFetch<{ items: SpellSummary[]; page: number; pageSize: number }>(
      `/spells${qs({ query, page })}`,
    ),
  get: (id: number) => apiFetch<{ spell: SpellDetail }>(`/spells/${id}`),
};

export const stylesApi = {
  search: (query: string, page = 1) =>
    apiFetch<{ items: StyleSummary[]; page: number; pageSize: number }>(
      `/styles${qs({ query, page })}`,
    ),
  get: (id: number) => apiFetch<{ style: StyleDetail }>(`/styles/${id}`),
};

// --- Geography (read-only) -------------------------------------------------

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

export const regionsApi = {
  search: (query: string, page = 1) =>
    apiFetch<{ items: RegionSummary[]; page: number; pageSize: number }>(
      `/regions${qs({ query, page })}`,
    ),
  get: (id: number) => apiFetch<{ region: RegionDetail }>(`/regions/${id}`),
};

export const zonesApi = {
  search: (query: string, page = 1) =>
    apiFetch<{ items: ZoneSummary[]; page: number; pageSize: number }>(
      `/zones${qs({ query, page })}`,
    ),
  get: (id: number) => apiFetch<{ zone: ZoneDetail }>(`/zones/${id}`),
};

export const teleportsApi = {
  search: (query: string, page = 1) =>
    apiFetch<{ items: Teleport[]; page: number; pageSize: number }>(
      `/teleports${qs({ query, page })}`,
    ),
};

// --- Server properties (read for staff; edit for admins) -------------------

export interface ServerProperty {
  key: string;
  category: string;
  description: string;
  defaultValue: string;
  value: string;
}

export const serverPropertiesApi = {
  search: (query: string, page = 1, pageSize = 50) =>
    apiFetch<{ items: ServerProperty[]; page: number; pageSize: number }>(
      `/server-properties${qs({ query, page, pageSize })}`,
    ),
  all: () => apiFetch<{ items: ServerProperty[] }>("/server-properties?all=true"),
  update: (key: string, value: string) =>
    apiFetch<{ property: ServerProperty; changed: boolean }>(
      `/server-properties/${encodeURIComponent(key)}`,
      { method: "PATCH", body: JSON.stringify({ value }) },
    ),
};

// --- XP rate (global multiplier; read for staff, edit for admins) ----------

export interface XpRate {
  key: string;
  description: string;
  defaultValue: string;
  defaultMultiplier: number;
  value: string;
  multiplier: number;
  max: number;
}

export const serverRatesApi = {
  getXp: () => apiFetch<{ rate: XpRate }>("/server-rates/xp"),
  setXp: (value: number) =>
    apiFetch<{ rate: XpRate; changed: boolean }>("/server-rates/xp", {
      method: "PATCH",
      body: JSON.stringify({ value }),
    }),
};

// --- Death XP loss (pve_exp_loss_level; read for staff, edit for admins) ----

export interface DeathXpLoss {
  key: string;
  description: string;
  value: string;
  startLevel: number;
  enabled: boolean;
  defaultValue: string;
  defaultStartLevel: number;
  defaultEnabled: boolean;
  disabledLevel: number;
  maxPlayerLevel: number;
  defaultStartLevelForEnable: number;
}

export interface DeathXpLossUpdate {
  enabled: boolean;
  startLevel?: number;
}

export const deathXpLossApi = {
  get: () => apiFetch<{ setting: DeathXpLoss }>("/death-xp-loss"),
  set: (update: DeathXpLossUpdate) =>
    apiFetch<{ setting: DeathXpLoss; changed: boolean }>("/death-xp-loss", {
      method: "PATCH",
      body: JSON.stringify(update),
    }),
};

/** Format a copper price into DAoC platinum/gold/silver/copper. */
export function formatMoney(copperTotal: number): string {
  if (!copperTotal || copperTotal <= 0) return "0c";
  let c = Math.floor(copperTotal);
  const plat = Math.floor(c / 10_000_000);
  c %= 10_000_000;
  const gold = Math.floor(c / 10_000);
  c %= 10_000;
  const silver = Math.floor(c / 100);
  const copper = c % 100;
  const parts: string[] = [];
  if (plat) parts.push(`${plat}p`);
  if (gold) parts.push(`${gold}g`);
  if (silver) parts.push(`${silver}s`);
  if (copper) parts.push(`${copper}c`);
  return parts.join(" ") || "0c";
}
