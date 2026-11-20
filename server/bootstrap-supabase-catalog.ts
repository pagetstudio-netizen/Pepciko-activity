import pg from "pg";

const { Pool } = pg;
const sourceUrl = process.env.DATABASE_URL;
const destinationUrl = process.env.SUPABASE_DATABASE_URL;

if (!sourceUrl || !destinationUrl) {
  throw new Error("DATABASE_URL and SUPABASE_DATABASE_URL are required.");
}
if (sourceUrl === destinationUrl) {
  throw new Error("Source and destination must be different databases.");
}

const tablesToCopy = [
  "countries",
  "products",
  "staking_products",
  "tasks",
  "payment_channels",
  "payment_numbers",
  "platform_settings",
] as const;

const destinationMustBeEmpty = [
  ...tablesToCopy,
  "users",
  "user_products",
  "deposits",
  "withdrawals",
  "withdrawal_wallets",
  "user_stakings",
  "referral_commissions",
  "user_tasks",
  "transactions",
  "admin_audit_log",
  "gift_codes",
  "gift_code_claims",
  "blog_posts",
  "session",
] as const;

type ColumnInfo = { column_name: string; udt_name: string };

const sourcePool = new Pool({ connectionString: sourceUrl });
const destinationPool = new Pool({
  connectionString: destinationUrl,
  ssl: { rejectUnauthorized: false },
});

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function getColumns(pool: pg.Pool, table: string): Promise<ColumnInfo[]> {
  const result = await pool.query<ColumnInfo>(
    `SELECT column_name, udt_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table],
  );
  return result.rows;
}

async function main() {
  const destinationClient = await destinationPool.connect();
  let activeTable = "preflight";
  let transactionStarted = false;

  try {
    for (const table of destinationMustBeEmpty) {
      activeTable = table;
      const targetColumns = await getColumns(destinationPool, table);
      if (targetColumns.length === 0) {
        throw new Error(`Required target table is missing: ${table}`);
      }
      const count = await destinationClient.query(
        `SELECT COUNT(*)::bigint AS count FROM public.${quoteIdentifier(table)}`,
      );
      if (Number(count.rows[0].count) !== 0) {
        throw new Error(`Target table is not empty: ${table}`);
      }
    }

    for (const table of tablesToCopy) {
      activeTable = table;
      const sourceColumns = await getColumns(sourcePool, table);
      const targetColumns = await getColumns(destinationPool, table);
      if (sourceColumns.length === 0 || targetColumns.length === 0) {
        throw new Error(`Required source or target table is missing: ${table}`);
      }
      const sourceShape = sourceColumns
        .map(({ column_name, udt_name }) => `${column_name}:${udt_name}`)
        .sort();
      const targetShape = targetColumns
        .map(({ column_name, udt_name }) => `${column_name}:${udt_name}`)
        .sort();
      if (JSON.stringify(sourceShape) !== JSON.stringify(targetShape)) {
        throw new Error(`Source and target schemas differ for table: ${table}`);
      }
    }

    await destinationClient.query("BEGIN");
    transactionStarted = true;
    const expectedCounts: Record<string, number> = {};

    for (const table of tablesToCopy) {
      activeTable = table;
      const columns = await getColumns(sourcePool, table);
      const columnNames = columns.map(({ column_name }) => column_name);
      const quotedColumns = columnNames.map(quoteIdentifier).join(", ");
      const sourceRows = await sourcePool.query(
        `SELECT ${quotedColumns} FROM public.${quoteIdentifier(table)} ORDER BY ${quoteIdentifier("id")}`,
      );
      expectedCounts[table] = sourceRows.rows.length;

      if (sourceRows.rows.length > 0) {
        const placeholders = columnNames.map((_, index) => `$${index + 1}`).join(", ");
        const insertQuery = `INSERT INTO public.${quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders})`;
        for (const row of sourceRows.rows) {
          const values = columnNames.map((column) => {
            if (
              (table === "platform_settings" && column === "modified_by")
              || (table === "payment_channels" && column === "modified_by")
              || (table === "payment_numbers" && column === "created_by")
            ) {
              return null;
            }
            return row[column];
          });
          await destinationClient.query(insertQuery, values);
        }
      }

      console.log(`${table}: copied ${sourceRows.rows.length} catalog/config rows`);
    }

    for (const table of tablesToCopy) {
      activeTable = table;
      const result = await destinationClient.query(
        `SELECT COUNT(*)::bigint AS count FROM public.${quoteIdentifier(table)}`,
      );
      const actualCount = Number(result.rows[0].count);
      if (actualCount !== expectedCounts[table]) {
        throw new Error(`Row count mismatch for table: ${table}`);
      }

      const sequenceResult = await destinationClient.query(
        "SELECT pg_get_serial_sequence($1, 'id') AS sequence_name",
        [`public.${table}`],
      );
      const sequenceName = sequenceResult.rows[0]?.sequence_name;
      if (sequenceName && actualCount > 0) {
        const maxId = await destinationClient.query(
          `SELECT MAX(${quoteIdentifier("id")}) AS max_id FROM public.${quoteIdentifier(table)}`,
        );
        await destinationClient.query(
          "SELECT setval($1::regclass, $2, true)",
          [sequenceName, Number(maxId.rows[0].max_id)],
        );
      }
    }

    await destinationClient.query("COMMIT");
    transactionStarted = false;
    console.log("Catalog and Admin settings copied. User accounts, balances, sessions, and histories were not copied.");
  } catch (error: any) {
    if (transactionStarted) {
      await destinationClient.query("ROLLBACK").catch(() => undefined);
    }
    console.error(`Supabase bootstrap stopped at ${activeTable}.`, error?.code || error?.name || "Unknown error");
    process.exitCode = 1;
  } finally {
    destinationClient.release();
    await Promise.all([sourcePool.end(), destinationPool.end()]);
  }
}

main().catch((error: any) => {
  console.error("Supabase bootstrap failed to initialize.", error?.code || error?.name || "Unknown error");
  process.exitCode = 1;
});
