import { createClient } from 'redis';
import { type QueriedReplyTree } from '../prisma/queries/reply';

const client = createClient({
  url:
    process.env.REDIS_URL ||
    (function () {
      throw new Error('Redis URL is missing.');
    })(),
});

client.on('error', (err) => console.error('Redis Client Error', err));
client.connect();

function getKey(postId: string, queryString: string) {
  return `GROVES_replies_${postId}_${queryString}`;
}

export async function saveReplyTree(
  postId: string,
  queryString: string,
  replyData: QueriedReplyTree,
) {
  const key = getKey(postId, queryString);
  await client.setEx(key, 6000, JSON.stringify(replyData));
}

export async function getSavedReplyTree(postId: string, queryString: string) {
  const key = getKey(postId, queryString);
  const string = await client.get(key);
  if (!string) return null;
  const replyData: QueriedReplyTree = JSON.parse(string);
  return replyData;
}

export async function expireSavedForPost(postId: string) {
  const pattern = `GROVES_replies_${postId}_*`;

  // first, find all keys under this post id
  const foundKeys: string[] = [];
  let cursor: number = 0;
  do {
    const scanResult = await client.scan(cursor, {
      MATCH: pattern,
      COUNT: 50, // in batches of fifty
    });
    cursor = scanResult.cursor;
    foundKeys.push(...scanResult.keys);
  } while (cursor !== 0);

  // then run mass delete. `del` is convenient to accept many keys
  await client.del(foundKeys);
}

export { client };
