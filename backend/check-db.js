const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "data", "carpool.db");
const db = new Database(dbPath);

try {
    console.log("✅ Connected to SQLite database.\n");

    const tables = db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    `).all();

    console.log("📋 Database tables:");

    for (const table of tables) {
        console.log(`\n🔹 ${table.name}`);

        const columns = db
            .prepare(`PRAGMA table_info(${table.name})`)
            .all();

        columns.forEach((column) => {
            console.log(
                `   ${column.name} | ${column.type} | PK:${column.pk} | NOT NULL:${column.notnull}`
            );
        });
    }

    console.log("\n🔗 Foreign key checks:");

    for (const table of tables) {
        const foreignKeys = db
            .prepare(`PRAGMA foreign_key_list(${table.name})`)
            .all();

        if (foreignKeys.length > 0) {
            console.log(`\n${table.name}:`);

            foreignKeys.forEach((fk) => {
                console.log(
                    `   ${fk.from} → ${fk.table}.${fk.to}`
                );
            });
        }
    }

    console.log("\n✅ Database verification completed.");

} catch (error) {
    console.error("❌ Database verification failed.");
    console.error(error);
    process.exitCode = 1;
} finally {
    db.close();
}