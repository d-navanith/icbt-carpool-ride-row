const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'carpool.db');

const db = new Database(dbPath, {
  timeout: 5000
});

// Enforce relational integrity.
db.pragma('foreign_keys = ON');

// Improve concurrent read performance.
db.pragma('journal_mode = WAL');

module.exports = db;