import fp from 'fastify-plugin';
import Redis from 'ioredis';

export default fp(async (fastify) => {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  fastify.decorate('redis', redis);
  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
});
