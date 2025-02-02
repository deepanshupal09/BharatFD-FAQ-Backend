import dotenv from "dotenv";
import { createClient } from 'redis';

dotenv.config();

const client = createClient({
    username: process.env.REDIS_USER,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT)||14775
    }
});

client.on('error', err => console.log('Redis Client Error', err));

export const connectRedis = async () =>  {
    await client.connect();
    // Test connection
    await client.set('foo', 'bar');
    const res = await client.get('foo');
    console.log('Redis connection test:', res);
};

// Directly use the client with native Promise support
export const redisClient = client;

// Add type definitions for better autocomplete
declare module 'redis' {
    interface RedisType {
        get: (key: string) => Promise<string | null>;
        set: (key: string, value: string, options?: { EX?: number }) => Promise<string | null>;
        keys: (pattern: string) => Promise<string[]>;
        del: (keys: string | string[]) => Promise<number>;
    }
}