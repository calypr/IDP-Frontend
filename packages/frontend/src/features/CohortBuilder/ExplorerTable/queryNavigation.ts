export interface QueryNavigation {
  readonly querySignature: string;
  readonly pageIndex: number;
  readonly cursors: Readonly<Record<number, string | null>>;
}

export const initialQueryNavigation = (
  querySignature: string,
): QueryNavigation => ({
  querySignature,
  pageIndex: 0,
  cursors: { 0: null },
});

export const currentQueryNavigation = (
  navigation: QueryNavigation,
  querySignature: string,
): QueryNavigation =>
  navigation.querySignature === querySignature
    ? navigation
    : initialQueryNavigation(querySignature);

export const moveQueryNavigation = ({
  navigation,
  querySignature,
  pageIndex,
  nextCursor,
}: {
  readonly navigation: QueryNavigation;
  readonly querySignature: string;
  readonly pageIndex: number;
  readonly nextCursor?: string;
}): QueryNavigation => {
  const current = currentQueryNavigation(navigation, querySignature);
  if (pageIndex === current.pageIndex + 1) {
    if (!nextCursor) return current;
    return {
      ...current,
      pageIndex,
      cursors: { ...current.cursors, [pageIndex]: nextCursor },
    };
  }
  return pageIndex === 0 || pageIndex in current.cursors
    ? { ...current, pageIndex }
    : current;
};
