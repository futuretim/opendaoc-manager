import { describe, expect, it } from "vitest";
import {
  buildGetAccountQuery,
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
  buildCharactersForAccountQuery,
  buildGetCharacterQuery,
  buildSearchCharactersQuery,
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
