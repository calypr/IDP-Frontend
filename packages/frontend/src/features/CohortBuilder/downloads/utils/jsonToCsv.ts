export const jsonToCsv = (data: Record<string, any>[]): string => {
  if (!data?.length) return '';
  const headers = [...new Set(data.flatMap(Object.keys))];
  
  const escape = (val: any): string => {
    if (val == null) return '';
    const str = String(val);
    // wrap in quotes if comma, quote, or newline (csv data syntax edge cases)
    return /[,"\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  
  return [
    headers.map(escape).join(','),
    ...data.map(row => headers.map(h => escape(row[h])).join(','))
  ].join('\n');
};