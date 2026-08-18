const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "carpool.db");
const schemaPath = path.join(__dirname, "schema.sql");

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(schemaPath)) {
    throw new Error("schema.sql was not found in the backend folder.");
}

const db = new Database(dbPath);

try {
    const schema = fs.readFileSync(schemaPath, "utf8");

    db.exec(schema);

    console.log("✅ SQLite database initialized successfully.");
    console.log(`📁 Database: ${dbPath}`);

    const tables = db
        .prepare(`
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
            ORDER BY name
        `)
        .all();

    console.log("\n📋 Tables created:");

    tables.forEach((table) => {
        console.log(` - ${table.name}`);
    });
} catch (error) {
    console.error("❌ Database initialization failed.");
    console.error(error);
    process.exitCode = 1;
} finally {
    db.close();
}