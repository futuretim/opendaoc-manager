import { describe, expect, it } from "vitest";
import {
  ACCOUNT_NAME_REFERENCES,
  buildGetAccountQuery,
  buildRenameAccountQuery,
  buildRenameReferenceQuery,
  buildResetPasswordQuery,
  buildSearchAccountsQuery,
  buildUpdateAccountQuery,
} from "./accounts.js";
import {
  buildAccountBanStatusQuery,
  buildCreateBanQuery,
  buildLiftBanQuery,
  buildListBansQuery,
} from "./bans.js";
import {
  REALM_SLOT_BASE,
  SLOTS_PER_REALM,
  buildCharacterOnlineQuery,
  buildCharactersForAccountQuery,
  buildGetCharacterQuery,
  buildMoveCharacterQuery,
  buildOccupiedSlotsQuery,
  buildRenameCharacterQuery,
  buildSearchCharactersQuery,
  buildUpdateCharacterQuery,
  firstFreeSlot,
} from "./characters.js";
import { buildGetQuestQuery, buildSearchQuestsQuery } from "./quests.js";
import { buildGetItemQuery, buildSearchItemsQuery } from "./items.js";
import { buildGetMobQuery, buildSearchMobsQuery } from "./mobs.js";
import { buildGetNpcTemplateQuery, buildSearchNpcTemplatesQuery } from "./npcTemplates.js";
import {
  buildListLootTemplatesQuery,
  buildLootEntriesQuery,
  buildMobsForLootTemplateQuery,
} from "./loot.js";
import { buildListMerchantListsQuery, buildMerchantEntriesQuery } from "./merchants.js";
import { buildGetSpellQuery, buildSearchSpellsQuery } from "./spells.js";
import { buildGetStyleQuery, buildSearchStylesQuery } from "./styles.js";
import {
  buildGetRegionQuery,
  buildGetZoneQuery,
  buildSearchRegionsQuery,
  buildSearchTeleportsQuery,
  buildZonesForRegionQuery,
} from "./geography.js";
import {
  buildGetServerPropertyQuery,
  buildListAllServerPropertiesQuery,
  buildListServerPropertiesQuery,
  buildUpdateServerPropertyQuery,
} from "./serverProperties.js";

describe("account query builders", () => {
  it("searches by name/discord with LIKE params", () => {
    const q = buildSearchAccountsQuery({ q: "bob", limit: 25, offset: 50 });
    expect(q.text).toContain("WHERE Name LIKE ? OR DiscordID LIKE ?");
    expect(q.text).toContain("LIMIT ? OFFSET ?");
    expect(q.values).toEqual(["%bob%", "%bob%", 25, 50]);
  });

  it("lists without a filter when query is empty", () => {
    const q = buildSearchAccountsQuery({ q: "  ", limit: 10, offset: 0 });
    expect(q.text).not.toContain("WHERE");
    expect(q.values).toEqual([10, 0]);
  });

  it("fetches one account by exact name", () => {
    const q = buildGetAccountQuery("Alice");
    expect(q.text).toMatch(/WHERE Name = \? LIMIT 1$/);
    expect(q.values).toEqual(["Alice"]);
  });

  it("builds a column-scoped password reset", () => {
    const q = buildResetPasswordQuery("Alice", "##HASH");
    expect(q.text).toBe("UPDATE account SET Password = ? WHERE Name = ?");
    expect(q.values).toEqual(["##HASH", "Alice"]);
  });

  it("maps only known updatable fields and coerces booleans", () => {
    const q = buildUpdateAccountQuery("Alice", {
      privLevel: 2,
      isMuted: true,
      notes: "warned twice",
    });
    expect(q.text).toBe("UPDATE account SET PrivLevel = ?, IsMuted = ?, Notes = ? WHERE Name = ?");
    expect(q.values).toEqual([2, 1, "warned twice", "Alice"]);
  });

  it("renames the account row by name", () => {
    const q = buildRenameAccountQuery("Old", "New");
    expect(q.text).toBe("UPDATE account SET Name = ? WHERE Name = ?");
    expect(q.values).toEqual(["New", "Old"]);
  });

  it("builds a backtick-escaped, name-scoped cascade for each reference", () => {
    const q = buildRenameReferenceQuery(
      { table: "DOLCharacters", column: "AccountName" },
      "Old",
      "New",
    );
    expect(q.text).toBe("UPDATE `DOLCharacters` SET `AccountName` = ? WHERE `AccountName` = ?");
    expect(q.values).toEqual(["New", "Old"]);
  });

  it("includes the characters and ban references but not AccountXMoney", () => {
    const tables = ACCOUNT_NAME_REFERENCES.map((r) => r.table);
    expect(tables).toContain("DOLCharacters");
    expect(tables).toContain("Ban");
    expect(tables).not.toContain("AccountXMoney");
  });

  it("throws when there is nothing to update", () => {
    expect(() => buildUpdateAccountQuery("Alice", {})).toThrow(/No updatable fields/);
  });
});

describe("character query builders", () => {
  it("filters by query and realm", () => {
    const q = buildSearchCharactersQuery({ q: "sir", realm: 1, limit: 25, offset: 0 });
    expect(q.text).toContain("WHERE (Name LIKE ? OR AccountName LIKE ?) AND Realm = ?");
    expect(q.values).toEqual(["%sir%", "%sir%", 1, 25, 0]);
  });

  it("lists all when no filters given", () => {
    const q = buildSearchCharactersQuery({ limit: 5, offset: 10 });
    expect(q.text).not.toContain("WHERE");
    expect(q.values).toEqual([5, 10]);
  });

  it("fetches a character and an account's characters", () => {
    expect(buildGetCharacterQuery("Hero").values).toEqual(["Hero"]);
    expect(buildCharactersForAccountQuery("Alice").text).toContain("WHERE AccountName = ?");
  });

  it("maps only known updatable character fields", () => {
    const q = buildUpdateCharacterQuery("Hero", { level: 50, realmPoints: 1000 });
    expect(q.text).toBe("UPDATE DOLCharacters SET Level = ?, RealmPoints = ? WHERE Name = ?");
    expect(q.values).toEqual([50, 1000, "Hero"]);
  });

  it("ignores unknown character fields and preserves column order", () => {
    const q = buildUpdateCharacterQuery("Hero", {
      bountyPoints: 5,
      realmLevel: 40,
      // @ts-expect-error — not an updatable field
      class: 99,
    });
    expect(q.text).toBe("UPDATE DOLCharacters SET RealmLevel = ?, BountyPoints = ? WHERE Name = ?");
    expect(q.values).toEqual([40, 5, "Hero"]);
  });

  it("throws when there is nothing to update on a character", () => {
    expect(() => buildUpdateCharacterQuery("Hero", {})).toThrow();
  });

  it("renames a character by name only", () => {
    const q = buildRenameCharacterQuery("Hero", "Villain");
    expect(q.text).toBe("UPDATE DOLCharacters SET Name = ? WHERE Name = ?");
    expect(q.values).toEqual(["Villain", "Hero"]);
  });

  it("queries occupied slots and moves to a chosen slot/account", () => {
    expect(buildOccupiedSlotsQuery("Alice", 2).values).toEqual(["Alice", 2]);
    const move = buildMoveCharacterQuery("Hero", "Alice", 203);
    expect(move.text).toBe(
      "UPDATE DOLCharacters SET AccountName = ?, AccountSlot = ? WHERE Name = ?",
    );
    expect(move.values).toEqual(["Alice", 203, "Hero"]);
  });
});

describe("firstFreeSlot", () => {
  it("returns the realm base slot when none are taken", () => {
    expect(firstFreeSlot(1, [])).toBe(100);
    expect(firstFreeSlot(2, [])).toBe(200);
    expect(firstFreeSlot(3, [])).toBe(300);
  });

  it("returns the lowest free slot, skipping occupied ones", () => {
    expect(firstFreeSlot(1, [100, 101, 103])).toBe(102);
    expect(firstFreeSlot(2, [200, 201, 202, 203, 204, 205, 206])).toBe(207);
  });

  it("returns null when all eight slots are taken", () => {
    const full = Array.from({ length: SLOTS_PER_REALM }, (_, i) => REALM_SLOT_BASE[1] + i);
    expect(firstFreeSlot(1, full)).toBeNull();
  });

  it("returns null for a non-playable realm", () => {
    expect(firstFreeSlot(0, [])).toBeNull();
    expect(firstFreeSlot(9, [])).toBeNull();
  });
});

describe("ban query builders", () => {
  it("lists all or by type", () => {
    expect(buildListBansQuery({ limit: 25, offset: 0 }).text).not.toContain("WHERE");
    const byType = buildListBansQuery({ type: "A", limit: 25, offset: 0 });
    expect(byType.text).toContain("WHERE Type = ?");
    expect(byType.values).toEqual(["A", 25, 0]);
  });

  it("inserts all required columns with NOW()", () => {
    const q = buildCreateBanQuery({
      id: "uuid-1",
      author: "gm@x",
      type: "B",
      ip: "1.2.3.4",
      account: "Alice",
      reason: "exploit",
    });
    expect(q.text).toContain("INSERT INTO Ban (Ban_ID, Author, Type, Ip, Account, DateBan, Reason)");
    expect(q.text).toContain("VALUES (?, ?, ?, ?, ?, NOW(), ?)");
    expect(q.values).toEqual(["uuid-1", "gm@x", "B", "1.2.3.4", "Alice", "exploit"]);
  });

  it("lifts by Ban_ID and checks account status like the server does", () => {
    expect(buildLiftBanQuery("uuid-1")).toEqual({
      text: "DELETE FROM Ban WHERE Ban_ID = ?",
      values: ["uuid-1"],
    });
    const status = buildAccountBanStatusQuery("Alice");
    expect(status.text).toContain("WHERE (Type = 'A' OR Type = 'B') AND Account = ?");
    expect(status.values).toEqual(["Alice"]);
  });
});

describe("quest query builders", () => {
  it("searches by name/start name with LIKE", () => {
    const q = buildSearchQuestsQuery({ q: "epic", limit: 25, offset: 0 });
    expect(q.text).toContain("FROM DataQuest");
    expect(q.text).toContain("WHERE Name LIKE ? OR StartName LIKE ?");
    expect(q.values).toEqual(["%epic%", "%epic%", 25, 0]);
  });

  it("lists all when no query", () => {
    const q = buildSearchQuestsQuery({ limit: 10, offset: 0 });
    expect(q.text).not.toContain("WHERE");
    expect(q.values).toEqual([10, 0]);
  });

  it("fetches a quest by numeric ID", () => {
    const q = buildGetQuestQuery(42);
    expect(q.text).toMatch(/WHERE ID = \? LIMIT 1$/);
    expect(q.values).toEqual([42]);
  });
});

describe("item query builders", () => {
  it("searches by name/id_nb with LIKE", () => {
    const q = buildSearchItemsQuery({ q: "sword", limit: 25, offset: 0 });
    expect(q.text).toContain("FROM ItemTemplate");
    expect(q.text).toContain("WHERE Name LIKE ? OR Id_nb LIKE ?");
    expect(q.values).toEqual(["%sword%", "%sword%", 25, 0]);
  });

  it("escapes the reserved Condition column with backticks", () => {
    const q = buildGetItemQuery("my_item");
    expect(q.text).toContain("`Condition`");
    expect(q.text).toMatch(/WHERE Id_nb = \? LIMIT 1$/);
    expect(q.values).toEqual(["my_item"]);
  });
});

describe("mob query builders", () => {
  it("searches by name/guild", () => {
    const q = buildSearchMobsQuery({ q: "wolf", limit: 25, offset: 0 });
    expect(q.text).toContain("FROM Mob WHERE Name LIKE ? OR Guild LIKE ?");
    expect(q.values).toEqual(["%wolf%", "%wolf%", 25, 0]);
  });

  it("fetches a mob by Mob_ID", () => {
    const q = buildGetMobQuery("guid-123");
    expect(q.text).toMatch(/WHERE Mob_ID = \? LIMIT 1$/);
    expect(q.values).toEqual(["guid-123"]);
  });
});

describe("npc template query builders", () => {
  it("searches by name or numeric TemplateId", () => {
    const q = buildSearchNpcTemplatesQuery({ q: "42", limit: 25, offset: 0 });
    expect(q.text).toContain("WHERE Name LIKE ? OR TemplateId = ?");
    expect(q.values).toEqual(["%42%", 42, 25, 0]);
  });

  it("uses -1 sentinel for TemplateId when query is non-numeric", () => {
    const q = buildSearchNpcTemplatesQuery({ q: "guard", limit: 25, offset: 0 });
    expect(q.values).toEqual(["%guard%", -1, 25, 0]);
  });

  it("fetches a template by TemplateId", () => {
    const q = buildGetNpcTemplateQuery(7);
    expect(q.text).toMatch(/WHERE TemplateId = \? LIMIT 1$/);
    expect(q.values).toEqual([7]);
  });
});

describe("loot query builders", () => {
  it("groups loot templates by name with entry counts", () => {
    const q = buildListLootTemplatesQuery({ q: "dragon", limit: 25, offset: 0 });
    expect(q.text).toContain("COUNT(*) AS entries FROM LootTemplate");
    expect(q.text).toContain("GROUP BY TemplateName");
    expect(q.values).toEqual(["%dragon%", "%dragon%", 25, 0]);
  });

  it("joins ItemTemplate for entry names and lists dropping mobs", () => {
    const entries = buildLootEntriesQuery("dragon_loot");
    expect(entries.text).toContain("LEFT JOIN ItemTemplate it ON it.Id_nb = lt.ItemTemplateID");
    expect(entries.text).toContain("WHERE lt.TemplateName = ?");
    expect(entries.values).toEqual(["dragon_loot"]);

    const mobs = buildMobsForLootTemplateQuery("dragon_loot");
    expect(mobs.text).toContain("FROM MobXLootTemplate");
    expect(mobs.text).toContain("WHERE LootTemplateName = ?");
    expect(mobs.values).toEqual(["dragon_loot"]);
  });
});

describe("merchant query builders", () => {
  it("groups merchant lists by ItemListID", () => {
    const q = buildListMerchantListsQuery({ limit: 25, offset: 0 });
    expect(q.text).toContain("COUNT(*) AS entries FROM MerchantItem");
    expect(q.text).toContain("GROUP BY ItemListID");
    expect(q.values).toEqual([25, 0]);
  });

  it("joins ItemTemplate and orders entries by page/slot", () => {
    const q = buildMerchantEntriesQuery(" albion_weapons");
    expect(q.text).toContain("LEFT JOIN ItemTemplate it ON it.Id_nb = mi.ItemTemplateID");
    expect(q.text).toContain("ORDER BY mi.PageNumber ASC, mi.SlotPosition ASC");
    expect(q.values).toEqual([" albion_weapons"]);
  });
});

describe("spell query builders", () => {
  it("searches by name or numeric SpellID and escapes reserved Range", () => {
    const q = buildSearchSpellsQuery({ q: "123", limit: 25, offset: 0 });
    expect(q.text).toContain("`Range`");
    expect(q.text).toContain("WHERE Name LIKE ? OR SpellID = ?");
    expect(q.values).toEqual(["%123%", 123, 25, 0]);
  });

  it("fetches a spell by SpellID", () => {
    const q = buildGetSpellQuery(99);
    expect(q.text).toMatch(/WHERE SpellID = \? LIMIT 1$/);
    expect(q.values).toEqual([99]);
  });
});

describe("style query builders", () => {
  it("searches by name or spec key", () => {
    const q = buildSearchStylesQuery({ q: "taunt", limit: 25, offset: 0 });
    expect(q.text).toContain("WHERE Name LIKE ? OR SpecKeyName LIKE ?");
    expect(q.values).toEqual(["%taunt%", "%taunt%", 25, 0]);
  });

  it("fetches a style by StyleID", () => {
    const q = buildGetStyleQuery(5);
    expect(q.text).toMatch(/WHERE StyleID = \? LIMIT 1$/);
    expect(q.values).toEqual([5]);
  });
});

describe("geography query builders", () => {
  it("searches regions by name or numeric id", () => {
    const q = buildSearchRegionsQuery({ q: "frontier", limit: 25, offset: 0 });
    expect(q.text).toContain("FROM Regions WHERE Name LIKE ? OR RegionID = ?");
    expect(q.values).toEqual(["%frontier%", -1, 25, 0]);
  });

  it("fetches a region and its zones", () => {
    expect(buildGetRegionQuery(1).values).toEqual([1]);
    const z = buildZonesForRegionQuery(1);
    expect(z.text).toContain("FROM Zones WHERE RegionID = ?");
    expect(z.values).toEqual([1]);
  });

  it("fetches a zone by ZoneID", () => {
    const q = buildGetZoneQuery(10);
    expect(q.text).toMatch(/WHERE ZoneID = \? LIMIT 1$/);
    expect(q.values).toEqual([10]);
  });

  it("searches teleports by id or type", () => {
    const q = buildSearchTeleportsQuery({ q: "inn", limit: 25, offset: 0 });
    expect(q.text).toContain("FROM Teleport WHERE TeleportID LIKE ? OR Type LIKE ?");
    expect(q.values).toEqual(["%inn%", "%inn%", 25, 0]);
  });
});

describe("server property query builders", () => {
  it("backtick-escapes the reserved Key column everywhere", () => {
    const list = buildListServerPropertiesQuery({ q: "xp", limit: 50, offset: 0 });
    expect(list.text).toContain("`Key` LIKE ?");
    expect(list.text).toContain("ORDER BY Category ASC, `Key` ASC");
    expect(list.values).toEqual(["%xp%", "%xp%", "%xp%", 50, 0]);

    const get = buildGetServerPropertyQuery("xp_rate");
    expect(get.text).toContain("WHERE `Key` = ? LIMIT 1");
    expect(get.values).toEqual(["xp_rate"]);
  });

  it("updates only the Value column, scoped by Key", () => {
    const q = buildUpdateServerPropertyQuery("xp_rate", "2.0");
    expect(q.text).toBe("UPDATE ServerProperty SET Value = ? WHERE `Key` = ?");
    expect(q.values).toEqual(["2.0", "xp_rate"]);
  });

  it("lists every property unpaginated, ordered by category then key", () => {
    const q = buildListAllServerPropertiesQuery();
    expect(q.text).toContain("FROM ServerProperty");
    expect(q.text).toContain("ORDER BY Category ASC, `Key` ASC");
    expect(q.text).not.toContain("LIMIT");
    expect(q.values).toEqual([]);
  });
});

import {
  ACCOUNT_VAULT_SLOT_MIN,
  ACCOUNT_VAULT_SLOT_MAX,
  BACKPACK_SLOT_MIN,
  BACKPACK_SLOT_MAX,
  EQUIPMENT_SLOT_MIN,
  EQUIPMENT_SLOT_MAX,
  HOUSE_VAULT_SLOT_MIN,
  HOUSE_VAULT_SLOT_MAX,
  HORSE_BAG_SLOT_MIN,
  HORSE_BAG_SLOT_MAX,
  PERSONAL_VAULT_SLOT_MIN,
  PERSONAL_VAULT_SLOT_MAX,
  buildAccountInventoryQuery,
  buildCharacterInventoryQuery,
  buildDeleteInventoryItemQuery,
  buildGetInventoryItemQuery,
  buildGrantInventoryItemQuery,
  buildGuildInventoryQuery,
  buildItemTemplateStackQuery,
  buildOwnerOnlineQuery,
  buildSlotOccupiedQuery,
  buildUpdateInventoryItemQuery,
  accountNameFromVaultOwnerId,
  accountVaultOwnerId,
  generateInventoryId,
  isWritableSlot,
  maxStackCount,
  scopeForSlot,
  slotGroupName,
} from "./inventory.js";

describe("inventory query builders", () => {
  it("builds a character inventory query covering equipment, backpack, horse bags, and vault", () => {
    const q = buildCharacterInventoryQuery("char_123");
    expect(q.text).toContain("FROM Inventory i");
    expect(q.text).toContain("LEFT JOIN ItemUnique u ON u.Id_nb = i.UTemplate_Id");
    expect(q.text).toContain("LEFT JOIN ItemTemplate t ON t.Id_nb = i.ITemplate_Id");
    expect(q.text).toContain("COALESCE(u.Name, t.Name) AS Name");
    expect(q.text).toContain("WHERE i.OwnerID = ?");
    expect(q.values[0]).toBe("char_123");
    // Slot ranges: equipment, backpack, personal vault, money
    expect(q.values).toContain(EQUIPMENT_SLOT_MIN);
    expect(q.values).toContain(EQUIPMENT_SLOT_MAX);
    expect(q.values).toContain(BACKPACK_SLOT_MIN);
    expect(q.values).toContain(BACKPACK_SLOT_MAX);
    expect(q.values).toContain(PERSONAL_VAULT_SLOT_MIN);
    expect(q.values).toContain(PERSONAL_VAULT_SLOT_MAX);
    expect(q.values).toContain(HORSE_BAG_SLOT_MIN);
    expect(q.values).toContain(HORSE_BAG_SLOT_MAX);
    expect(q.values).not.toContain(500); // money lives in DOLCharacters, not Inventory
  });

  it("builds a guild inventory query scoped to house-vault slots", () => {
    const q = buildGuildInventoryQuery("guild_abc");
    expect(q.text).toContain("WHERE i.OwnerID = ? AND ((i.SlotPosition >= ? AND i.SlotPosition <= ?))");
    expect(q.values).toEqual(["guild_abc", HOUSE_VAULT_SLOT_MIN, HOUSE_VAULT_SLOT_MAX]);
  });

  it("builds an account inventory query with the accountName_RealmName owner ID", () => {
    const q = buildAccountInventoryQuery("Alice", 1);
    expect(q.text).toContain("WHERE i.OwnerID = ? AND ((i.SlotPosition >= ? AND i.SlotPosition <= ?))");
    expect(q.values).toEqual(["Alice_Albion", ACCOUNT_VAULT_SLOT_MIN, ACCOUNT_VAULT_SLOT_MAX]);
  });

  it("builds account vault owner IDs from the eRealm enum name, like OpenDAoC", () => {
    expect(accountVaultOwnerId("Alice", 1)).toBe("Alice_Albion");
    expect(accountVaultOwnerId("my_acct", 2)).toBe("my_acct_Midgard");
    expect(accountVaultOwnerId("Alice", 3)).toBe("Alice_Hibernia");
    expect(() => accountVaultOwnerId("Alice", 0)).toThrow(/Unknown realm/);
    expect(accountNameFromVaultOwnerId("my_acct_Midgard")).toBe("my_acct");
    expect(accountNameFromVaultOwnerId("159f95e2-1717-4e67-babc-b154f99c4f33")).toBeNull();
  });

  it("selects MaxCharges from the template, not the Inventory row", () => {
    const q = buildCharacterInventoryQuery("char_123");
    expect(q.text).toContain("COALESCE(u.MaxCharges, t.MaxCharges) AS MaxCharges");
    expect(q.text).not.toContain("i.MaxCharges");
  });

  it("builds a get-single-item query by Inventory_ID", () => {
    const q = buildGetInventoryItemQuery("inv_xyz");
    expect(q.text).toContain("WHERE i.Inventory_ID = ? LIMIT 1");
    expect(q.values).toEqual(["inv_xyz"]);
  });

  it("maps only known updatable inventory fields", () => {
    const q = buildUpdateInventoryItemQuery("inv_1", { slotPosition: 45, count: 10 });
    expect(q.text).toBe("UPDATE Inventory SET `SlotPosition` = ?, `Count` = ? WHERE Inventory_ID = ?");
    expect(q.values).toEqual([45, 10, "inv_1"]);
  });

  it("ignores unknown inventory fields", () => {
    const q = buildUpdateInventoryItemQuery("inv_1", {
      sellPrice: 100,
      // @ts-expect-error - not an updatable field
      ownerId: "hacker",
    });
    expect(q.text).toBe("UPDATE Inventory SET `SellPrice` = ? WHERE Inventory_ID = ?");
    expect(q.values).toEqual([100, "inv_1"]);
  });

  it("backtick-quotes the reserved Condition column in updates", () => {
    const q = buildUpdateInventoryItemQuery("inv_1", { condition: 100 });
    expect(q.text).toBe("UPDATE Inventory SET `Condition` = ? WHERE Inventory_ID = ?");
  });

  it("throws when there is nothing to update on an inventory item", () => {
    expect(() => buildUpdateInventoryItemQuery("inv_1", {})).toThrow(/No updatable fields/);
  });

  it("builds a delete query scoped by Inventory_ID", () => {
    const q = buildDeleteInventoryItemQuery("inv_1");
    expect(q.text).toBe("DELETE FROM Inventory WHERE Inventory_ID = ?");
    expect(q.values).toEqual(["inv_1"]);
  });

  it("builds a slot-occupied check", () => {
    const q = buildSlotOccupiedQuery("owner_1", 50);
    expect(q.text).toBe("SELECT Inventory_ID FROM Inventory WHERE OwnerID = ? AND SlotPosition = ? LIMIT 1");
    expect(q.values).toEqual(["owner_1", 50]);
  });

  it("builds an item-template stack lookup", () => {
    const q = buildItemTemplateStackQuery("sword_01");
    expect(q.text).toBe("SELECT Id_nb, MaxCount FROM ItemTemplate WHERE Id_nb = ? LIMIT 1");
    expect(q.values).toEqual(["sword_01"]);
  });

  it("caps counts at 1 for non-stackables and MaxCount for stackables", () => {
    expect(maxStackCount({ isStackable: false, maxCount: 50 })).toBe(1);
    expect(maxStackCount({ isStackable: true, maxCount: 50 })).toBe(50);
    expect(maxStackCount({ isStackable: true, maxCount: 0 })).toBe(1);
  });

  it("builds an owner-online check over character, guild, and vault owners", () => {
    const q = buildOwnerOnlineQuery("owner_1", "Alice");
    expect(q.text).toContain("a.LastLogin > a.LastDisconnected");
    expect(q.text).toContain("c.DOLCharacters_ID = ? OR c.GuildID = ?");
    expect(q.values).toEqual(["Alice", "owner_1", "owner_1"]);
  });

  it("maps slots to scopes and only allows writes to bag and vault slots", () => {
    expect(scopeForSlot(10)).toBe("character");
    expect(scopeForSlot(85)).toBe("character");
    expect(scopeForSlot(1000)).toBe("guild");
    expect(scopeForSlot(2600)).toBe("account");
    expect(scopeForSlot(500)).toBeNull();
    expect(isWritableSlot("character", 40)).toBe(true);
    expect(isWritableSlot("character", 120)).toBe(true);
    expect(isWritableSlot("character", 10)).toBe(false); // equipment
    expect(isWritableSlot("character", 2550)).toBe(false); // account vault range
    expect(isWritableSlot("guild", 1500)).toBe(true);
    expect(isWritableSlot("guild", 40)).toBe(false);
    expect(isWritableSlot("account", 2699)).toBe(true);
    expect(isWritableSlot("account", 1000)).toBe(false);
  });

  it("builds a grant query that inserts from ItemTemplate defaults", () => {
    const q = buildGrantInventoryItemQuery({
      inventoryId: "inv_new",
      ownerId: "owner_1",
      slotPosition: 50,
      itemTemplateId: "sword_01",
      count: 1,
      sellPrice: 0,
    });
    expect(q.text).toContain("INSERT INTO Inventory");
    expect(q.text).toContain("FROM ItemTemplate t WHERE t.Id_nb = ?");
    expect(q.text).toContain("t.MaxCondition");
    expect(q.text).toContain("t.MaxDurability");
    expect(q.text).toContain("`Condition`");
    expect(q.values).toEqual(["inv_new", "owner_1", "sword_01", 50, 1, 0, "sword_01"]);
  });

  it("generates unique inventory IDs", () => {
    const a = generateInventoryId();
    const b = generateInventoryId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });

  it("classifies slot groups correctly", () => {
    expect(slotGroupName(500)).toBe("Other");
    expect(slotGroupName(80)).toBe("Horse Bags");
    expect(slotGroupName(10)).toBe("Equipped");
    expect(slotGroupName(40)).toBe("Backpack");
    expect(slotGroupName(79)).toBe("Backpack");
    expect(slotGroupName(110)).toBe("Personal Vault");
    expect(slotGroupName(149)).toBe("Personal Vault");
    expect(slotGroupName(1000)).toBe("Guild Vault");
    expect(slotGroupName(1799)).toBe("Guild Vault");
    expect(slotGroupName(2500)).toBe("Account Vault");
    expect(slotGroupName(2699)).toBe("Account Vault");
    expect(slotGroupName(9999)).toBe("Other");
  });
});

describe("character query builders - stats and money", () => {
  it("maps stats and money fields to columns", () => {
    const q = buildUpdateCharacterQuery("Hero", {
      strength: 100,
      dexterity: 80,
      constitution: 90,
      quickness: 70,
      intelligence: 60,
      piety: 50,
      empathy: 40,
      charisma: 30,
      health: 500,
      mana: 300,
      endurance: 200,
      copper: 1000,
      silver: 50,
      gold: 10,
      platinum: 1,
      mithril: 0,
    });
    expect(q.text).toContain("Strength = ?");
    expect(q.text).toContain("Dexterity = ?");
    expect(q.text).toContain("Constitution = ?");
    expect(q.text).toContain("Quickness = ?");
    expect(q.text).toContain("Intelligence = ?");
    expect(q.text).toContain("Piety = ?");
    expect(q.text).toContain("Empathy = ?");
    expect(q.text).toContain("Charisma = ?");
    expect(q.text).toContain("Health = ?");
    expect(q.text).toContain("Mana = ?");
    expect(q.text).toContain("Endurance = ?");
    expect(q.text).toContain("Copper = ?");
    expect(q.text).toContain("Silver = ?");
    expect(q.text).toContain("Gold = ?");
    expect(q.text).toContain("Platinum = ?");
    expect(q.text).toContain("Mithril = ?");
    expect(q.values).toContain(100);
    expect(q.values).toContain(1000);
    expect(q.values[q.values.length - 1]).toBe("Hero");
  });

  it("checks whether a character's account is online", () => {
    const q = buildCharacterOnlineQuery("Hero");
    expect(q.text).toContain("JOIN DOLCharacters c ON c.AccountName = a.Name");
    expect(q.text).toContain("a.LastLogin > a.LastDisconnected");
    expect(q.values).toEqual(["Hero"]);
  });

  it("fetches character detail with guild name subquery", () => {
    const q = buildGetCharacterQuery("Hero");
    expect(q.text).toContain("Strength");
    expect(q.text).toContain("GuildID");
    expect(q.text).toContain("GuildRank");
    expect(q.text).toContain("SELECT g.GuildName FROM Guild g");
    expect(q.values).toEqual(["Hero"]);
  });
});
