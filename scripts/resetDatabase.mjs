#!/usr/bin/env node
/**
 * Drops the entire MongoDB database named in MONGODB_URI (destructive).
 * Hebrew: מחיקה מלאה של מסד הנתונים — יצירת מערכת "ריקה" מחדש.
 *
 * Usage:
 *   CONFIRM_DB_RESET=1 node scripts/resetDatabase.mjs
 *   node scripts/resetDatabase.mjs --yes
 *
 * Loads .env from project root when MONGODB_URI is not already set.
 */
import mongoose from 'mongoose';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  const txt = readFileSync(envPath, 'utf8');
  for (const raw of txt.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === '') {
      process.env[key] = val;
    }
  }
}

loadEnvFile();

const confirmed =
  process.argv.includes('--yes') ||
  process.argv.includes('-y') ||
  process.env.CONFIRM_DB_RESET === '1';

if (!confirmed) {
  console.error(`
מחיקת מסד נתונים — פעולה הרסנית.

הרץ שוב עם אחת מהאפשרויות:
  CONFIRM_DB_RESET=1 node scripts/resetDatabase.mjs
  node scripts/resetDatabase.mjs --yes
`);
  process.exit(1);
}

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error('חסר MONGODB_URI (ב-.env או בסביבה).');
  process.exit(1);
}

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const name = mongoose.connection.db?.databaseName;
  console.log(`מסיר את מסד הנתונים: ${name}`);
  await mongoose.connection.db.dropDatabase();
  console.log('הושלם — המסד ריק; אינדקסים ייווצרו מחדש כשיש כתיבה מהמודלים.');
  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  console.error('שגיאה:', err.message || err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
}
