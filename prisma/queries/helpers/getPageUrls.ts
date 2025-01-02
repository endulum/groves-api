export function getPageUrls(
  nextCursor: string | undefined,
  prevCursor: string | undefined,
  queries: Record<string, string>,
  baseString: string,
) {
  const queryString = new URLSearchParams(
    Object.fromEntries(
      Object.entries(queries).filter(([_, value]) => value != ''),
    ),
  ).toString();

  const nextPage = nextCursor
    ? `${baseString}?after=${nextCursor}&${queryString}`
    : null;
  const prevPage = prevCursor
    ? `${baseString}?before=${prevCursor}&${queryString}`
    : null;

  return { nextPage, prevPage };
}
