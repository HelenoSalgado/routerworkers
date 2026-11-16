/**
 * RouteParser - Parser seguro e eficiente para rotas estáticas e parametrizadas
 * Opera segmento a segmento com suporte a UTF-8, escape de RegExp e proteção contra URIError
 */

export interface RouteMatch {
  matched: boolean;
  params: Record<string, string>;
}

type CompiledSegment =
  | { kind: 'literal'; value: string; rawOnly: boolean }
  | { kind: 'param'; name: string }
  | { kind: 'mixed'; pattern: RegExp; paramNames: string[] };

const REGEX_META_CHARS = /[.*+?^${}()|[\]\\]/g;
const PARAM_PATTERN = /:([a-zA-Z_]\w*)/g;

/**
 * Escapa todos os metacaracteres de expressão regular em um trecho literal.
 */
function escapeRegExp(value: string): string {
  return value.replace(REGEX_META_CHARS, '\\$&');
}

/**
 * Verifica se uma chave pode causar prototype pollution.
 */
export function isDangerousKey(key: string): boolean {
  return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

/**
 * Decodifica um componente de URI com segurança, retornando null em caso de URIError.
 */
export function safeDecodeURIComponent(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * Compara um pathname de requisição com uma rota estática (sem parâmetros),
 * decodificando segmento a segmento para suportar caracteres não-ASCII e
 * rejeitar sequências percentuais malformadas sem lançar exceções.
 */
export function matchStaticPath(
  requestPathname: string,
  routePath: string,
): boolean {
  if (requestPathname === routePath) {
    return true;
  }

  const reqSegments = requestPathname.split('/');
  const routeSegments = routePath.split('/');

  if (reqSegments.length !== routeSegments.length) {
    return false;
  }

  for (let i = 0; i < routeSegments.length; i++) {
    const decodedRoute = safeDecodeURIComponent(routeSegments[i]);
    if (decodedRoute === null) {
      if (reqSegments[i] !== routeSegments[i]) {
        return false;
      }
      continue;
    }

    const decodedReq = safeDecodeURIComponent(reqSegments[i]);
    if (decodedReq === null || decodedReq !== decodedRoute) {
      return false;
    }
  }

  return true;
}

export class RouteParser {
  private readonly segments: CompiledSegment[];

  constructor(route: string) {
    this.segments = route
      .split('/')
      .map((segment) => this.compileSegment(segment));
  }

  private compileSegment(segment: string): CompiledSegment {
    const paramMatches = Array.from(segment.matchAll(PARAM_PATTERN));

    if (paramMatches.length === 0) {
      const decoded = safeDecodeURIComponent(segment);
      return {
        kind: 'literal',
        value: decoded ?? segment,
        rawOnly: decoded === null,
      };
    }

    if (paramMatches.length === 1 && paramMatches[0][0] === segment) {
      return {
        kind: 'param',
        name: paramMatches[0][1],
      };
    }

    let regexSource = '^';
    let cursor = 0;
    const paramNames: string[] = [];

    for (const match of paramMatches) {
      const matchIndex = match.index ?? 0;
      if (matchIndex > cursor) {
        const rawLiteral = segment.slice(cursor, matchIndex);
        const decodedLiteral = safeDecodeURIComponent(rawLiteral) ?? rawLiteral;
        regexSource += escapeRegExp(decodedLiteral);
      }
      paramNames.push(match[1]);
      regexSource += '([\\s\\S]+)';
      cursor = matchIndex + match[0].length;
    }

    if (cursor < segment.length) {
      const rawTrailing = segment.slice(cursor);
      const decodedTrailing =
        safeDecodeURIComponent(rawTrailing) ?? rawTrailing;
      regexSource += escapeRegExp(decodedTrailing);
    }

    regexSource += '$';
    return {
      kind: 'mixed',
      pattern: new RegExp(regexSource),
      paramNames,
    };
  }

  /**
   * Verifica se o pathname corresponde à rota e extrai parâmetros com segurança.
   */
  match(pathname: string): RouteMatch {
    const reqSegments = pathname.split('/');
    if (reqSegments.length !== this.segments.length) {
      return { matched: false, params: {} };
    }

    const params: Record<string, string> = {};

    for (let i = 0; i < this.segments.length; i++) {
      const compiled = this.segments[i];
      const rawReqSegment = reqSegments[i];

      if (compiled.kind === 'literal') {
        if (compiled.rawOnly) {
          if (rawReqSegment !== compiled.value) {
            return { matched: false, params: {} };
          }
          continue;
        }

        const decodedReq = safeDecodeURIComponent(rawReqSegment);
        if (decodedReq === null || decodedReq !== compiled.value) {
          return { matched: false, params: {} };
        }
        continue;
      }

      const decodedReq = safeDecodeURIComponent(rawReqSegment);
      if (decodedReq === null || decodedReq === '') {
        return { matched: false, params: {} };
      }

      if (compiled.kind === 'param') {
        if (!isDangerousKey(compiled.name)) {
          params[compiled.name] = decodedReq;
        }
        continue;
      }

      const matches = compiled.pattern.exec(decodedReq);
      if (!matches) {
        return { matched: false, params: {} };
      }

      for (let j = 0; j < compiled.paramNames.length; j++) {
        const paramName = compiled.paramNames[j];
        if (!isDangerousKey(paramName)) {
          params[paramName] = matches[j + 1];
        }
      }
    }

    return { matched: true, params };
  }
}
