import { redisClient } from '../config/redis';

export const getCacheTranslation = async (id: string, lang: string) => {
    const key = `faq:${id}:${lang}`;
    try {
        return await redisClient.get(key);
    } catch (error) {
        console.error('Redis get error:', error);
        return null;
    }
};

export const setCacheTranslation = async (id: string, lang: string, answer: string) => {
    const key = `faq:${id}:${lang}`;
    try {
        await redisClient.set(key, answer, { EX: 3600 }); // 1 hour expiration
    } catch (error) {
        console.error('Redis set error:', error);
    }
};

export const invalidateCache = async (id: string) => {
    const pattern = `faq:${id}:*`;
    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
        }
    } catch (error) {
        console.error('Cache invalidation error:', error);
    }
};