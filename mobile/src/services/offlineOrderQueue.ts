import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import { PaymentMethod, PaymentStatus } from "./types";

const DB_NAME = "canteen-offline.db";
const LEGACY_QUEUE_KEY = (tenantId: string, userId: string) => `offline_order_queue:${tenantId}:${userId}`;
const LEGACY_MENU_KEY = (tenantId: string) => `pos_menu_cache:${tenantId}`;

type QueueRow = {
  id: number;
  tenant_id: string;
  user_id: string;
  items_json: string;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus | null;
  source: "STUDENT" | "POS" | null;
  queued_at: string;
};

type MenuCacheRow = {
  tenant_id: string;
  categories_json: string;
  menu_json: string;
  updated_at: string;
};

export type QueuedOrder = {
  items: { menuItemId: string; quantity: number; note?: string }[];
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  source?: "STUDENT" | "POS";
  queuedAt: string;
};

type QueueItem = { menuItemId: string; quantity: number; note?: string };

export type PosMenuCache = {
  categories: { id: string; name: string }[];
  menu: { id: string; categoryId?: string; name: string; price: number; stockQty: number }[];
  updatedAt: string;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let schemaInitialized = false;
const migratedQueueKeys = new Set<string>();
const migratedMenuKeys = new Set<string>();

const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  const db = await dbPromise;
  if (!schemaInitialized) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS offline_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        items_json TEXT NOT NULL,
        payment_method TEXT,
        payment_status TEXT,
        source TEXT,
        queued_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_offline_orders_tenant_user_time
        ON offline_orders (tenant_id, user_id, queued_at, id);

      CREATE TABLE IF NOT EXISTS offline_pos_menu_cache (
        tenant_id TEXT PRIMARY KEY NOT NULL,
        categories_json TEXT NOT NULL,
        menu_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    schemaInitialized = true;
  }
  return db;
};

const normalizeQueue = (value: unknown): QueuedOrder[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const obj = entry as Record<string, unknown>;
      const items = Array.isArray(obj.items)
        ? obj.items
            .map((item): QueueItem | null => {
              if (!item || typeof item !== "object") return null;
              const itemObj = item as Record<string, unknown>;
              const menuItemId = typeof itemObj.menuItemId === "string" ? itemObj.menuItemId : "";
              const quantity = Number(itemObj.quantity ?? 0);
              if (!menuItemId || !Number.isFinite(quantity) || quantity <= 0) return null;
              const note = typeof itemObj.note === "string" ? itemObj.note : undefined;
              return note ? { menuItemId, quantity, note } : { menuItemId, quantity };
            })
            .filter((item): item is QueueItem => Boolean(item))
        : [];

      if (items.length === 0) return null;
      return {
        items,
        paymentMethod: typeof obj.paymentMethod === "string" ? (obj.paymentMethod as PaymentMethod) : undefined,
        paymentStatus: typeof obj.paymentStatus === "string" ? (obj.paymentStatus as PaymentStatus) : undefined,
        source: obj.source === "POS" ? "POS" : "STUDENT",
        queuedAt: typeof obj.queuedAt === "string" ? obj.queuedAt : new Date().toISOString()
      } as QueuedOrder;
    })
    .filter((entry): entry is QueuedOrder => Boolean(entry));
};

const migrateLegacyQueueIfNeeded = async (tenantId: string, userId: string): Promise<void> => {
  const migrationKey = `${tenantId}:${userId}`;
  if (migratedQueueKeys.has(migrationKey)) return;

  const legacyRaw = await AsyncStorage.getItem(LEGACY_QUEUE_KEY(tenantId, userId));
  if (legacyRaw) {
    try {
      const parsed = normalizeQueue(JSON.parse(legacyRaw));
      if (parsed.length > 0) {
        const db = await getDb();
        await db.withExclusiveTransactionAsync(async (tx) => {
          for (const entry of parsed) {
            await tx.runAsync(
              `INSERT INTO offline_orders
               (tenant_id, user_id, items_json, payment_method, payment_status, source, queued_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              tenantId,
              userId,
              JSON.stringify(entry.items),
              entry.paymentMethod ?? null,
              entry.paymentStatus ?? null,
              entry.source ?? "STUDENT",
              entry.queuedAt
            );
          }
        });
      }
    } catch {
      // Ignore malformed legacy data.
    } finally {
      await AsyncStorage.removeItem(LEGACY_QUEUE_KEY(tenantId, userId));
    }
  }

  migratedQueueKeys.add(migrationKey);
};

const migrateLegacyMenuIfNeeded = async (tenantId: string): Promise<void> => {
  if (migratedMenuKeys.has(tenantId)) return;
  const legacyRaw = await AsyncStorage.getItem(LEGACY_MENU_KEY(tenantId));
  if (legacyRaw) {
    try {
      const parsed = JSON.parse(legacyRaw) as PosMenuCache;
      if (Array.isArray(parsed.categories) && Array.isArray(parsed.menu)) {
        const db = await getDb();
        await db.runAsync(
          `INSERT INTO offline_pos_menu_cache
           (tenant_id, categories_json, menu_json, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(tenant_id) DO UPDATE SET
             categories_json = excluded.categories_json,
             menu_json = excluded.menu_json,
             updated_at = excluded.updated_at`,
          tenantId,
          JSON.stringify(parsed.categories),
          JSON.stringify(parsed.menu),
          parsed.updatedAt ?? new Date().toISOString()
        );
      }
    } catch {
      // Ignore malformed legacy cache.
    } finally {
      await AsyncStorage.removeItem(LEGACY_MENU_KEY(tenantId));
    }
  }
  migratedMenuKeys.add(tenantId);
};

export const offlineOrderQueue = {
  async get(tenantId: string, userId: string): Promise<QueuedOrder[]> {
    await migrateLegacyQueueIfNeeded(tenantId, userId);
    const db = await getDb();
    const rows = await db.getAllAsync<QueueRow>(
      `SELECT id, tenant_id, user_id, items_json, payment_method, payment_status, source, queued_at
       FROM offline_orders
       WHERE tenant_id = ? AND user_id = ?
       ORDER BY queued_at ASC, id ASC`,
      tenantId,
      userId
    );
    return rows
      .map((row) => {
        let items: { menuItemId: string; quantity: number; note?: string }[] = [];
        try {
          const parsed = JSON.parse(row.items_json);
          items = normalizeQueue([{ items: parsed }])[0]?.items ?? [];
        } catch {
          items = [];
        }
        if (items.length === 0) return null;
        return {
          items,
          paymentMethod: row.payment_method ?? undefined,
          paymentStatus: row.payment_status ?? undefined,
          source: row.source ?? "STUDENT",
          queuedAt: row.queued_at
        } as QueuedOrder;
      })
      .filter((entry): entry is QueuedOrder => Boolean(entry));
  },

  async add(
    tenantId: string,
    userId: string,
    order: {
      items: { menuItemId: string; quantity: number; note?: string }[];
      paymentMethod?: PaymentMethod;
      paymentStatus?: PaymentStatus;
      source?: "STUDENT" | "POS";
    }
  ): Promise<void> {
    await migrateLegacyQueueIfNeeded(tenantId, userId);
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO offline_orders
       (tenant_id, user_id, items_json, payment_method, payment_status, source, queued_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      tenantId,
      userId,
      JSON.stringify(order.items),
      order.paymentMethod ?? null,
      order.paymentStatus ?? null,
      order.source ?? "STUDENT",
      new Date().toISOString()
    );
  },

  async clear(tenantId: string, userId: string): Promise<void> {
    await migrateLegacyQueueIfNeeded(tenantId, userId);
    const db = await getDb();
    await db.runAsync(`DELETE FROM offline_orders WHERE tenant_id = ? AND user_id = ?`, tenantId, userId);
  },

  async getPosMenuCache(tenantId: string): Promise<PosMenuCache | null> {
    await migrateLegacyMenuIfNeeded(tenantId);
    const db = await getDb();
    const row = await db.getFirstAsync<MenuCacheRow>(
      `SELECT tenant_id, categories_json, menu_json, updated_at
       FROM offline_pos_menu_cache
       WHERE tenant_id = ?`,
      tenantId
    );
    if (!row) return null;
    try {
      return {
        categories: JSON.parse(row.categories_json) as PosMenuCache["categories"],
        menu: JSON.parse(row.menu_json) as PosMenuCache["menu"],
        updatedAt: row.updated_at
      };
    } catch {
      return null;
    }
  },

  async setPosMenuCache(tenantId: string, value: PosMenuCache): Promise<void> {
    await migrateLegacyMenuIfNeeded(tenantId);
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO offline_pos_menu_cache
       (tenant_id, categories_json, menu_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(tenant_id) DO UPDATE SET
         categories_json = excluded.categories_json,
         menu_json = excluded.menu_json,
         updated_at = excluded.updated_at`,
      tenantId,
      JSON.stringify(value.categories),
      JSON.stringify(value.menu),
      value.updatedAt
    );
  }
};
