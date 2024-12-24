/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function formatReplies({
  replies,
  query,
  queryString,
  userId,
  commMods,
  commAdmin,
}: {
  replies: any[]; // i promise i know what i'm doing!
  query?: {
    postId: string;
    parentId?: string;
    cursor?: string;
    levels: number;
    takePerLevel: number;
    takeAtRoot: number | null;
    sort?: string;
  };
  queryString?: string;
  userId: number | null;
  commMods: Array<{ id: number }>;
  commAdmin: { id: number };
}) {
  return replies.map((reply) => {
    reply.context = {};
    // handle context
    reply.context.youVoted = {
      upvoted:
        reply.upvotes.find((u: { id: number }) => u.id === userId) !==
        undefined,
      downvoted:
        reply.downvotes.find((u: { id: number }) => u.id === userId) !==
        undefined,
    };
    reply.context.authorIsMod =
      commMods.find((mod) => mod.id === reply.author.id) !== undefined;
    reply.context.authorIsAdmin = commAdmin.id === reply.author.id;

    // handle pagination links
    if (query && 'children' in reply && reply.children.length > 0) {
      if (query.takePerLevel < reply._count.children) {
        const cutoffChild = reply.children.pop();
        if (cutoffChild)
          reply.loadMoreChildren = `/reply/${reply.id}/replies?cursor=${
            cutoffChild.id
          }&${queryString}`;
      }
      reply.children = formatReplies({
        replies: reply.children,
        query,
        queryString,
        userId,
        commMods,
        commAdmin,
      });
    } else {
      if (reply._count.children > 0) {
        reply.loadChildren = `/reply/${reply.id}/replies`;
        if (queryString) reply.loadChildren += `?${queryString}`;
      }
    }

    // handle nullifying hidden content
    if (reply.hidden === true) {
      reply.author = null;
      reply.content = null;
      reply._count.upvotes = null;
      reply._count.downvotes = null;
    }

    const { upvotes, downvotes, ...newReply } = reply;
    return newReply;
  });
}
