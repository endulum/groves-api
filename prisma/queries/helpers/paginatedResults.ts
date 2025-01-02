function getSearchParams<T>(
  cursor: number | string | undefined,
  direction: 'forward' | 'backward' | 'none',
  take: number,
) {
  return {
    cursor: cursor ? { id: cursor as T } : undefined,
    skip: direction === 'none' ? undefined : 1,
    take: (direction === 'backward' ? -1 : 1) * (take + 1),
  };
}

export async function paginatedResults<T>(
  // T represents the type of id.
  // the id is a string for posts/replies and a number for users/comms/actions
  // it makes sense to just provide the id type here
  params: {
    before?: number | string; // cursor for paging backwards
    after?: number | string; // cursor for paging forwards
    take: number; // page size
  },
  find: (
    searchParams: ReturnType<typeof getSearchParams<T>>,
  ) => Promise<Array<{ id: number | string }>>,
) {
  const cursor = params.after ?? params.before;
  const direction = params.after
    ? 'forward'
    : params.before
      ? 'backward'
      : 'none';

  const searchParams = getSearchParams<T>(cursor, direction, params.take);

  const found: Array<{ id: string | number }> = await find(searchParams);

  const results =
    direction === 'backward'
      ? found.slice(-params.take)
      : found.slice(0, params.take);

  const hasMore = found.length > params.take;

  const nextCursor =
    direction === 'backward' || hasMore ? results.at(-1)?.id : null;
  const prevCursor =
    direction === 'forward' || (direction === 'backward' && hasMore)
      ? results.at(0)?.id
      : null;

  return { results, nextCursor, prevCursor };
}
