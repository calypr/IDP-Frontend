export const jsonToCsv = (data: Record<string, any>[]): string => {
  if (!data?.length) return '';

  // Replace the spread operator [...] with Array.from()
  const headers = Array.from(new Set(data.flatMap(Object.keys)));

  const escape = (val: any): string => {
    if (val == null) return '';
    const str = String(val);
    return /[,"\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  return [
    headers.map(escape).join(','),
    ...data.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ].join('\n');
};
