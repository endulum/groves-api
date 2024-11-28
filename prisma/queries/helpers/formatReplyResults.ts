type Reply = {
  id: string;
  // ... and the rest of the usual reply content.
  author: { username: string; id: string };
  votes: { upvotes: number; downvotes: number; youVoted: boolean | null };
  content: string;
  datePosted: string;
  status: string;

  children?: Reply[];
  // a reply may or may not have children.
  totalChildCount: number;
  // but a reply definitely has a total child count.
  // if there isnt a children property, the total should be zero

  // if there is less children rendered than counted,
  // supply a link to load replies using this reply's id as the root
  // and with a given cursor
  loadMoreChildren?: string;
  // e.g. /reply/:reply?cursor=__________&{...queries}

  // if there is no children rendered but count is nonzero,
  // supply a link to load replies using this reply's id as the root
  loadChildren?: string;
  // e.g. /reply/:reply&{...queries}
};

export function formatReplyResults(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: any[], // i do not have the brainpower now to tighten this
  opts: {
    takePerLevel: number; // for turning the extra 1 result into the next cursor
    userId: number | null; // for checking against the vote list of each reply
    rebuiltQuery: string | null; // for preserving sort (and what else?)
  },
) {
  return results.map((result) => {
    const reply: Reply = {
      id: result.id,
      author: result.author,
      votes: {
        upvotes: result._count.upvotes,
        downvotes: result._count.downvotes,
        youVoted: null,
      },
      datePosted: result.datePosted,
      status: result.status,
      content: result.status === 'HIDDEN' ? null : result.content,
      totalChildCount: 0,
    };

    // handle children
    if (opts.userId) {
      const upvoted = result.upvotes.find(
        (u: { id: number }) => u.id === opts.userId,
      );
      const downvoted = result.downvotes.find(
        (u: { id: number }) => u.id === opts.userId,
      );
      reply.votes.youVoted = upvoted !== undefined || downvoted !== undefined;
    } else {
      reply.votes.youVoted = null;
    }

    // handle children
    if (result?._count?.children)
      reply.totalChildCount = result._count.children;
    if ('children' in result && result.children.length > 0) {
      if (opts.takePerLevel < result._count.children) {
        const { id } = result.children.pop();
        reply.loadMoreChildren = `/reply/${reply.id}?cursor=${id}`;
        // todo: i added a slash and it got me an html error. suppress that, this is a json-only api
        if (opts.rebuiltQuery)
          reply.loadMoreChildren += `&${opts.rebuiltQuery}`;
      }
      reply.children = formatReplyResults(result.children, opts);
    } else {
      if (result._count.children > 0) {
        reply.loadChildren = `/reply/${reply.id}`;
        if (opts.rebuiltQuery) reply.loadChildren += `?${opts.rebuiltQuery}`;
      }
    }

    return reply;
  });
}
