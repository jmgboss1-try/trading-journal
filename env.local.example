import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
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
    res.status(500).json({ error: err.message });
  }
}
