/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function formatReplies({
  replies,
  query,
  queryString,
  userId,
}: {
  replies: any[]; // i promise i know what i'm doing!
  query: {
    postId: string;
    parentId?: string;
    cursor?: string;
    levels: number;
    takePerLevel: number;
    takeAtRoot: number | null;
    sort?: string;
  };
  queryString: string;
  userId: number | null;
}) {
  return replies.map((reply) => {
    // handle voting view
    if (userId) {
      reply.voted = {
        upvoted:
          reply.upvotes.find((u: { id: number }) => u.id === userId) !==
          undefined,
        downvoted:
          reply.downvotes.find((u: { id: number }) => u.id === userId) !==
          undefined,
      };
    } else {
      reply.voted = null;
    }

    // handle pagination links
    if ('children' in reply && reply.children.length > 0) {
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
      });
    } else {
      if (reply._count.children > 0) {
        reply.loadChildren = `/reply/${reply.id}/replies`;
        if (queryString) reply.loadChildren += `?${queryString}`;
      }
    }

    // handle status
    if (reply.status === 'HIDDEN') {
      reply.content = null;
      reply.author = null;
    }

    const { upvotes, downvotes, ...newReply } = reply;
    return newReply;
  });
}
