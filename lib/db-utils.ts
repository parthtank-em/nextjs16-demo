import { sql } from "./db";

export type QueryResult<T = any> = {
  rows: T[];
  rowCount: number;
};

/** Run a query and return typed rows */
export async function query<T = any>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  try {
    const result = await sql<T>(strings, ...values);
    return result;
  } catch (error) {
    console.error("DB Query Error:", error);
    throw new Error("Database query failed");
  }
}

/** Query expecting only one row */
export async function queryOne<T = any>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T | null> {
  const rows = await query<T>(strings, ...values);
  return rows.length > 0 ? rows[0] : null;
}

/** Run a transaction */
export async function transaction<T>(callback: (tx: typeof sql) => Promise<T>) {
  try {
    await sql`BEGIN`;
    const result = await callback(sql);
    await sql`COMMIT`;
    return result;
  } catch (error) {
    await sql`ROLLBACK`;
    console.error("Transaction Error:", error);
    throw new Error("Database transaction failed");
  }
}
