import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { writeAudit } from "../audit.js";
import { clientIp, requireRole } from "../auth/guards.js";
import { createItem, getItem, ITEM_FIELDS, searchItems, updateItem } from "../db/items.js";

const listQuery = z.object({
  query: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// Build a zod shape from the shared field metadata so API validation and the
// DB write layer never drift apart.
const fieldShape: Record<string, z.ZodTypeAny> = {};
for (const f of ITEM_FIELDS) {
  if (f.kind === "bool") fieldShape[f.key] = z.boolean().optional();
  else if (f.kind === "string") fieldShape[f.key] = z.string().max(4000).optional();
  else fieldShape[f.key] = z.number().int().optional(); // int | long
}

const updateBody = z
  .object(fieldShape)
  .strict()
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });

const createBody = z
  .object({
    idNb: z
      .string()
      .min(1)
      .max(255)
      .regex(/^[\x21-\x7e]+$/, "Id_nb must be printable ASCII with no spaces"),
    name: z.string().min(1).max(255),
    ...fieldShape,
  })
  .strict();

export async function itemRoutes(app: FastifyInstance): Promise<void> {
  app.get("/items", async (request) => {
    const { query, page, pageSize } = listQuery.parse(request.query);
    const items = await searchItems({
      q: query,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { items, page, pageSize };
  });

  app.get("/items/:idNb", async (request, reply) => {
    const { idNb } = request.params as { idNb: string };
    const item = await getItem(idNb);
    if (!item) {
      return reply.code(404).send({ error: { code: "not_found", message: "Item not found." } });
    }
    return { item };
  });

  // Create — admin only.
  app.post("/items", { preHandler: requireRole("admin") }, async (request, reply) => {
    const parsed = createBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid item." } });
    }
    const { idNb, ...values } = parsed.data;
    if (await getItem(idNb)) {
      return reply
        .code(409)
        .send({ error: { code: "conflict", message: "An item with that Id_nb already exists." } });
    }
    await createItem(idNb, values);
    await writeAudit({
      actorUserId: request.authUser?.id ?? null,
      action: "item.create",
      target: `item:${idNb}`,
      metadata: { idNb, name: parsed.data.name },
      ip: clientIp(request),
    });
    const item = await getItem(idNb);
    return reply.code(201).send({ item });
  });

  // Edit existing — admin only; column-scoped to the submitted fields.
  app.patch("/items/:idNb", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { idNb } = request.params as { idNb: string };
    const parsed = updateBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid payload." } });
    }
    if (!(await getItem(idNb))) {
      return reply.code(404).send({ error: { code: "not_found", message: "Item not found." } });
    }
    await updateItem(idNb, parsed.data);
    await writeAudit({
      actorUserId: request.authUser?.id ?? null,
      action: "item.update",
      target: `item:${idNb}`,
      metadata: { fields: Object.keys(parsed.data) },
      ip: clientIp(request),
    });
    const item = await getItem(idNb);
    return { item };
  });
}
