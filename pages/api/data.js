import { Redis } from '@upstash/redis';

// REDIS_URL 형식: redis://default:TOKEN@HOST:PORT
// REST URL 형식으로 변환
function getRedisClient() {
  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // REST 방식 (UPSTASH_REDIS_REST_URL + TOKEN)
  if (token) {
    return Redis.fromEnv();
  }

  // REDIS_URL 파싱해서 REST URL로 변환
  // redis://default:TOKEN@host:port -> https://host REST + TOKEN
  if (redisUrl && redisUrl.startsWith('redis')) {
    const match = redisUrl.match(/redis:\/\/[^:]+:([^@]+)@([^:]+):?\d*/);
    if (match) {
      const parsedToken = match[1];
      const host = match[2];
      const restUrl = 'https://' + host;
      return new Redis({ url: restUrl, token: parsedToken });
    }
  }

  return Redis.fromEnv();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const redis = getRedisClient();
    if (req.method === 'GET') {
      const { key } = req.query;
      const data = await redis.get(key);
      return res.status(200).json({ data: data || null });
    }
    if (req.method === 'POST') {
      const { key, value } = req.body;
      await redis.set(key, value);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const { key } = req.query;
      await redis.del(key);
      return res.status(200).json({ ok: true });
    }
  } catch (err) {
    console.error('Redis error:', err);
    res.status(500).json({ error: err.message });
  }
}
