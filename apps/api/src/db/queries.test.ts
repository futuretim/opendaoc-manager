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
