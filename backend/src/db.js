const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'carpool.db');

const db = new Database(dbPath, {
  timeout: 5000
});

// Enforce relational integrity.
db.pragma('foreign_keys = ON');

// Improve concurrent read performance.
db.pragma('journal_mode = WAL');

module.exports = db;