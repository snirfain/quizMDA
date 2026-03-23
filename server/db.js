import mongoose from 'mongoose';

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

export async function ensureDbConnection() {
  if (isDbConnected()) return true;
  const uri = process.env.MONGODB_URI;
  if (!uri) return false;
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    return isDbConnected();
  } catch (_) {
    return false;
  }
}
