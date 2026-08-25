import http from "node:http";
import { config } from "./config.js";
import { db } from "./store.js";

const MAX_LIMIT = 100;

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function normalizeAddress(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(v) ? v : null;
}

function positiveInt(value: string | null, fallback: number): number {
  const n = Number(value ?? fallback);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return n;
}

function encodeCursor(value: number): string {
  return Buffer.from(String(value), "utf8").toString("base64url");
}

function decodeCursor(value: string | null): number | null {
  if (!value) return null;
  try {
    const n = Number(Buffer.from(value, "base64url").toString("utf8"));
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

async function listListings(url: URL) {
  const limit = Math.min(positiveInt(url.searchParams.get("limit"), 25), MAX_LIMIT);
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  const seller = normalizeAddress(url.searchParams.get("seller"));
  const token = normalizeAddress(url.searchParams.get("token"));
  const status = url.searchParams.get("status")?.toUpperCase();

  if (url.searchParams.has("seller") && !seller) throw new Error("Invalid seller address");
  if (url.searchParams.has("token") && !token) throw new Error("Invalid token address");
  if (status && !["UNKNOWN", "ACTIVE", "PAUSED", "CLOSED", "SUSPENDED"].includes(status)) {
    throw new Error("Invalid status");
  }
  if (url.searchParams.has("cursor") && cursor === null) throw new Error("Invalid cursor");

  let query = db
    .from("listings")
    .select("*")
    .eq("chain_id", config.chainId)
    .eq("contract_address", config.escrowAddress.toLowerCase())
    .order("listing_id", { ascending: true })
    .limit(limit + 1);

  if (cursor !== null) query = query.gt("listing_id", cursor);
  if (seller) query = query.eq("seller", seller);
  if (token) query = query.eq("token_contract", token);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? encodeCursor(Number(items[items.length - 1].listing_id)) : null;

  return { items, pagination: { limit, nextCursor, hasMore } };
}

async function getListing(id: string) {
  if (!/^\d+$/.test(id)) throw new Error("Invalid listing id");
  const { data, error } = await db
    .from("listings")
    .select("*")
    .eq("chain_id", config.chainId)
    .eq("contract_address", config.escrowAddress.toLowerCase())
    .eq("listing_id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data;
}

export const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method !== "GET") {
      res.setHeader("allow", "GET");
      return json(res, 405, { error: "Method not allowed" });
    }

    if (url.pathname === "/health") {
      return json(res, 200, { ok: true, chainId: config.chainId });
    }

    if (url.pathname === "/listings") {
      return json(res, 200, { success: true, ...(await listListings(url)) });
    }

    const match = url.pathname.match(/^\/listings\/(\d+)$/);
    if (match) {
      const listing = await getListing(match[1]);
      if (!listing) return json(res, 404, { success: false, error: "Listing not found" });
      return json(res, 200, { success: true, data: listing });
    }

    return json(res, 404, { success: false, error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const clientError = message.startsWith("Invalid ");
    return json(res, clientError ? 400 : 500, { success: false, error: message });
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(config.apiPort, () => {
    console.log(`UStetu read API listening on :${config.apiPort}`);
  });
}
