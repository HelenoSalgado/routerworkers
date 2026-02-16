export function getQueryInPathName(
  search: string,
): Record<string, any> | undefined {
  if (search.includes('?')) {
    const preQueries = search
      .replaceAll('%5B', '[')
      .replaceAll('%5D', ']')
      .replaceAll('%20', ' ')
      .slice(1)
      .toString()
      .split('&');
    const queries: Record<string, any> = {};

    preQueries.forEach((query: any) => {
      const q = query.split('=');

      function transformQueries(value: any): any {
        if (value == 'true') return (queries[q[0]] = true);
        if (value == 'false') return (queries[q[0]] = false);
        if (!Number.isNaN(Number.parseInt(value))) return parseInt(value);
        if (q[1].includes('[') && q[1].includes(']')) {
          const array = q[1].replace('[', '').replace(']', '').split(',');
          const arrayModify = array.map((value: any) => {
            if (value == 'true') return true;
            if (value == 'false') return false;
            if (!Number.isNaN(Number.parseInt(value))) return parseInt(value);
            if (typeof value == 'string')
              return value.replaceAll('%27', '').replaceAll('%22', '');
            return value;
          });
          return arrayModify;
        }
        if (typeof value == 'string')
          return value.replaceAll('%27', '').replaceAll('%22', '');
        return value;
      }
      queries[q[0]] = transformQueries(q[1]);
    });
    return queries;
  } else {
    return undefined;
  }
}
