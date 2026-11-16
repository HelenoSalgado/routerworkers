import { isDangerousKey, safeDecodeURIComponent } from './routeParser';

function parseScalarQueryValue(value: string): string | number | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value !== '' && /^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value.replaceAll('%27', '').replaceAll('%22', '');
}

function transformQueryValue(rawVal: string): any {
  const decoded = (safeDecodeURIComponent(rawVal) ?? rawVal)
    .replaceAll('%5B', '[')
    .replaceAll('%5D', ']')
    .replaceAll('%20', ' ');

  if (decoded.includes('[') && decoded.includes(']')) {
    const inner = decoded.replace('[', '').replace(']', '');
    if (inner === '') return [];
    return inner.split(',').map((item) => {
      const decodedItem = safeDecodeURIComponent(item) ?? item;
      return parseScalarQueryValue(decodedItem);
    });
  }

  return parseScalarQueryValue(decoded);
}

export function getQueryInPathName(
  search: string,
): Record<string, any> | undefined {
  if (!search || !search.includes('?')) {
    return undefined;
  }

  const rawSearch = search.slice(search.indexOf('?') + 1);
  if (!rawSearch) {
    return undefined;
  }

  const pairs = rawSearch.split('&');
  const queries: Record<string, any> = {};
  let hasEntries = false;

  for (const pair of pairs) {
    if (!pair) continue;

    const eqIndex = pair.indexOf('=');
    const rawKey = eqIndex === -1 ? pair : pair.slice(0, eqIndex);
    const rawVal = eqIndex === -1 ? '' : pair.slice(eqIndex + 1);

    const key = (safeDecodeURIComponent(rawKey) ?? rawKey)
      .replaceAll('%5B', '[')
      .replaceAll('%5D', ']')
      .replaceAll('%20', ' ');

    if (!key || isDangerousKey(key)) {
      continue;
    }

    queries[key] = transformQueryValue(rawVal);
    hasEntries = true;
  }

  return hasEntries ? queries : undefined;
}
