import { createClient } from 'redis';

const client = createClient({
  url:
    process.env.REDIS_URL ||
    (function () {
      throw new Error('Redis URL is missing.');
    })(),
});

client.on('error', (err) => console.error('Redis Client Error', err));
client.connect();

export { client };
