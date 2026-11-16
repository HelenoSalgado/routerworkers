/**
 * Utilitário nativo para servir Static Assets do Cloudflare Workers (env.ASSETS)
 * Suporta filtros de prefixo, Cache-Control automático, headers customizados e guards de autenticação
 */

import type { Req, Res } from '../../types/index';

export interface AssetFetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface AssetsGuard {
  /**
   * Prefixo de caminho protegido (ex: '/content/' ou '/private')
   */
  prefix: string;
  /**
   * Função ou middleware de autorização.
   * Pode chamar `res.unauthorized()` / `res.forbidden()` diretamente ou retornar `false` para bloquear.
   */
  authorize: (req: Req, res: Res) => Promise<boolean | void> | boolean | void;
  /**
   * Mensagem de erro quando `authorize` retorna `false` sem ter enviado resposta via `res.*`
   * @default 'Unauthorized'
   */
  unauthorizedMessage?: string;
}

export interface AssetsOptions {
  /**
   * Lista de prefixos de pathname que devem ser atendidos pelo binding de assets.
   * Se omitido, qualquer rota não resolvida (exceto `excludePrefixes`) será encaminhada ao ASSETS.
   */
  includePrefixes?: string[];
  /**
   * Lista de prefixos de pathname que NUNCA devem ser encaminhados ao ASSETS (ex: ['/api']).
   */
  excludePrefixes?: string[];
  /**
   * Valor de Cache-Control aplicado em respostas 2xx quando o asset não define Cache-Control próprio.
   * Passe `false` para desativar.
   * @default 'public, max-age=604800, immutable'
   */
  cacheControl?: string | false;
  /**
   * Headers adicionais para injetar na resposta do asset (ex: Cross-Origin-Resource-Policy).
   */
  headers?: Record<string, string>;
  /**
   * Guards de proteção por prefixo executados antes de `binding.fetch(req)`.
   */
  guards?: AssetsGuard[];
  /**
   * Se `true`, quando `binding.fetch()` retornar 404, não marca a requisição como resolvida,
   * permitindo que o `notFoundHandler` do RouterWorkers assuma.
   * @default false
   */
  fallthroughOn404?: boolean;
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === '/') return true;
  const cleanPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  return pathname === cleanPrefix || pathname.startsWith(`${cleanPrefix}/`);
}

export async function handleStaticAssets(
  req: Req,
  res: Res,
  pathname: string,
  isResolved: () => boolean,
  binding?: AssetFetcher,
  options: AssetsOptions = {},
): Promise<Response | null> {
  if (!binding || isResolved()) {
    return null;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return null;
  }

  const {
    includePrefixes,
    excludePrefixes,
    cacheControl = 'public, max-age=604800, immutable',
    headers: extraHeaders,
    guards,
    fallthroughOn404 = false,
  } = options;

  if (
    excludePrefixes &&
    excludePrefixes.some((prefix) => matchesPrefix(pathname, prefix))
  ) {
    return null;
  }

  if (
    includePrefixes &&
    includePrefixes.length > 0 &&
    !includePrefixes.some((prefix) => matchesPrefix(pathname, prefix))
  ) {
    return null;
  }

  if (guards && guards.length > 0) {
    for (const guard of guards) {
      if (matchesPrefix(pathname, guard.prefix)) {
        const result = await guard.authorize(req, res);
        if (isResolved()) {
          return null;
        }
        if (result === false) {
          res.unauthorized(guard.unauthorizedMessage || 'Unauthorized');
          return null;
        }
      }
    }
  }

  const assetResponse = await binding.fetch(req);

  if (fallthroughOn404 && assetResponse.status === 404) {
    return null;
  }

  const responseHeaders = new Headers(assetResponse.headers);

  if (
    cacheControl !== false &&
    assetResponse.status >= 200 &&
    assetResponse.status < 300 &&
    !responseHeaders.has('Cache-Control')
  ) {
    responseHeaders.set('Cache-Control', cacheControl);
  }

  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      responseHeaders.set(key, value);
    }
  }

  return new Response(assetResponse.body, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers: responseHeaders,
  });
}
