import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getRegion,
  getZone,
  searchRegions,
  searchTeleports,
  searchZones,
} from "../db/geography.js";

const listQuery = z.object({
  query: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function geographyRoutes(app: FastifyInstance): Promise<void> {
  app.get("/regions", async (request) => {
    const { query, page, pageSize } = listQuery.parse(request.query);
    const items = await searchRegions({ q: query, limit: pageSize, offset: (page - 1) * pageSize });
    return { items, page, pageSize };
  });

  app.get("/regions/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id)) {
      return reply.code(400).send({ error: { code: "bad_request", message: "Invalid region id." } });
    }
    const region = await getRegion(id);
    if (!region) {
      return reply.code(404).send({ error: { code: "not_found", message: "Region not found." } });
    }
    return { region };
  });

  app.get("/zones", async (request) => {
    const { query, page, pageSize } = listQuery.parse(request.query);
    const items = await searchZones({ q: query, limit: pageSize, offset: (page - 1) * pageSize });
    return { items, page, pageSize };
  });

  app.get("/zones/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id)) {
      return reply.code(400).send({ error: { code: "bad_request", message: "Invalid zone id." } });
    }
    const zone = await getZone(id);
    if (!zone) {
      return reply.code(404).send({ error: { code: "not_found", message: "Zone not found." } });
    }
    return { zone };
  });

  app.get("/teleports", async (request) => {
    const { query, page, pageSize } = listQuery.parse(request.query);
    const items = await searchTeleports({ q: query, limit: pageSize, offset: (page - 1) * pageSize });
    return { items, page, pageSize };
  });
}
