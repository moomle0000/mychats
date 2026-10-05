import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://192.168.0.12:27017/chatSSE';

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongoose || (global.mongoose = { conn: null, promise: null });

export const dbConnection = async () => {
  if (cached.conn) {
    return cached.conn;
  }
  if (!cached.promise) {
    const isDev = (process.env.NODE_ENV || 'development') === 'development';
    const opts: mongoose.ConnectOptions = {
      bufferCommands: true,
      autoIndex: isDev,
      minPoolSize: 5,
      maxPoolSize: 20,
      maxIdleTimeMS: 30000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 10000,
    };
    cached.promise = mongoose.connect(MONGODB_URI, opts).then(async (m) => {
      console.log(`[Database] Connected successfully (autoIndex: ${isDev})`);
      return m;
    });
  }
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
};
