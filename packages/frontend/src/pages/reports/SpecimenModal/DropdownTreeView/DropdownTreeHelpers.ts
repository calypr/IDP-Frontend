// replace each id key as a label in a nested JSON
export const replaceIdsWithLabels = (idMap: Record<string,string>, nestedDict: Record<string,any>): Record<string,any> => {
  if (Array.isArray(nestedDict)) {
    return nestedDict.map(item => replaceIdsWithLabels(idMap, item));
  }

  if (typeof nestedDict === 'object' && nestedDict !== null) {
    return Object.fromEntries(
      Object.entries(nestedDict).map(([key, value]) => [
        idMap[key] ?? key, // use nullish coalescing to avoid falsy values like 0
        replaceIdsWithLabels(idMap, value)
      ])
    );
  }

  return nestedDict; // base case: primitive value
  };
  
// read a nested tree of format {a: {b: {c: null}}, d} and convert it to react complex tree format
export const readTemplate = (template: Record<string, any>, data: Record<string, any> = { items: {} }) => {
  for (const [key, value] of Object.entries(template)) {
    data.items[key] = {
      index: key,
      canMove: true,
      isFolder: value !== null,
      children: value !== null ? Object.keys(value as object) : undefined,
      data: key,
      canRename: true
    };

    if (value !== null) {
      readTemplate(value, data);
    }
  }

  return data;
};
  
// sort json keys before outputting 
export const sortJsonKeys = (obj: unknown): unknown => 
  typeof obj !== 'object' || obj === null 
    ? obj 
    : Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        (acc as Record<string, unknown>)[key] = sortJsonKeys((obj as Record<string, unknown>)[key]);
        return acc;
      }, {} as Record<string, unknown>);