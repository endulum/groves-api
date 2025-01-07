import { client } from '../client';

const reduceScore = (
  acc: number,
  curr: { _count: { upvotes: number; downvotes: number } },
) => {
  const score = curr._count.upvotes - curr._count.downvotes;
  if (score > 0) return acc + score;
  return acc;
};

export async function getForUser(id: number) {
  const postVerdancy = (
    await client.post.findMany({
      where: { author: { id } },
      select: { _count: { select: { upvotes: true, downvotes: true } } },
    })
  ).reduce(reduceScore, 0);

  const replyVerdancy = (
    await client.reply.findMany({
      where: { author: { id } },
      select: { _count: { select: { upvotes: true, downvotes: true } } },
    })
  ).reduce(reduceScore, 0);

  return { replyVerdancy, postVerdancy };
}
