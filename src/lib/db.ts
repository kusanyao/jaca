import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

/** 全局单例：首次调用时打开 SQLite 数据库并执行 Rust 侧注册的迁移。 */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load("sqlite:jaca.db").catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}
