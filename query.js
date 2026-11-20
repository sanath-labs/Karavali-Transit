// query.js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sqlite3 from 'sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, 'transit.db');

const db = new sqlite3.Database(dbPath, err => {
  if (err) {
    console.error('❌ Could not open DB:', err.message);
    process.exit(1);
  }
});

const sql = `
  SELECT bus_id, latitude, longitude, speed, accuracy, recorded_at
  FROM gps_telemetry
  ORDER BY recorded_at DESC
  LIMIT 5;
`;

db.all(sql, (err, rows) => {
  if (err) {
    console.error('❌ Query error:', err.message);
  } else {
    console.table(rows);
  }
  db.close();
});