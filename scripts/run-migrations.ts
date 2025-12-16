#!/usr/bin/env node

import "dotenv/config";
import { Client } from "pg";
import { join } from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { readdir, readFile } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!connectionString) {
    console.error(
      "ERROR: DATABASE_URL or POSTGRES_URL environment variable not set"
    );
    process.exit(1);
  }

  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log("✓ Connected to database\n");

    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Migrations table ready\n");

    // Get list of SQL files in migrations directory
    const migrationsDir = join(__dirname, "..", "migrations");
    const files = await readdir(migrationsDir);

    const migrationFiles = files
      .filter((f) => f.endsWith(".sql") && /^\d+/.test(f))
      .sort();

    console.log(`Found ${migrationFiles.length} migration file(s)\n`);

    // Check which migrations have been run
    const result = await client.query(
      "SELECT filename FROM migrations ORDER BY filename"
    );
    const executedMigrations = new Set(result.rows.map((r) => r.filename));

    console.log(`Found ${executedMigrations.size} executed migration(s)\n`);

    // Filter pending migrations
    const pendingMigrations = migrationFiles.filter(
      (file) => !executedMigrations.has(file)
    );

    if (pendingMigrations.length === 0) {
      console.log("✓ No pending migrations. Database is up to date!");
      return;
    }

    console.log(
      `Running ${pendingMigrations.length} pending migration(s)...\n`
    );

    // Run pending migrations
    for (const file of pendingMigrations) {
      console.log(`Running migration: ${file}`);

      const sqlPath = join(migrationsDir, file);
      const sql = await readFile(sqlPath, "utf-8");

      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO migrations (filename) VALUES ($1)", [
          file,
        ]);
        await client.query("COMMIT");
        console.log(`✓ Migration ${file} completed\n`);
      } catch (error) {
        await client.query("ROLLBACK");
        console.error(
          `✗ Migration ${file} failed:`,
          error instanceof Error ? error.message : error
        );
        throw error;
      }
    }

    console.log("✓ All migrations completed successfully!");
  } catch (error) {
    console.error("\n✗ Migration error:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migrations
runMigrations();
