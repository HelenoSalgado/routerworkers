import {
  Args,
  Caches,
  ConfigWorker,
  DefaultResponseType,
  Req,
  Res,
  ErrorHandler,
  NotFoundHandler,
  Middleware,
  RouteHandler,
} from '../types/index';
import { getQueryInPathName } from './utils/getQueries';
import {
  RouteParser,
  RouteMatch,
  matchStaticPath,
  safeDecodeURIComponent,
} from './utils/routeParser';
import {
  AssetFetcher,
  AssetsGuard,
  AssetsOptions,
  handleStaticAssets,
} from './utils/assets';

// Exportar validador built-in
export { validate, schemas, ValidationError } from './utils/validator';
export type {
  ValidationRule,
  ValidationSchema,
  ValidateConfig,
} from './utils/validator';

// Exportar CORS e Security Headers middlewares
export { cors, corsDevMode, corsProduction } from './middlewares/cors';
export type { CorsOptions } from './middlewares/cors';
export { securityHeaders } from './middlewares/securityHeaders';
export type { SecurityHeadersOptions } from './middlewares/securityHeaders';

// Exportar Route Groups
export { group, RouteGroup } from './utils/routeGroup';
export type { RouteGroupConfig } from './utils/routeGroup';

// Exportar utilitários de rota e tipos públicos
export { RouteParser, matchStaticPath, safeDecodeURIComponent };
export type {
  RouteMatch,
  AssetFetcher,
  AssetsGuard,
  AssetsOptions,
  Args,
  Caches,
  ConfigWorker,
  DefaultResponseType,
  Req,
  Res,
  ErrorHandler,
  NotFoundHandler,
  Middleware,
  RouteHandler,
};

declare const caches: Caches;

function isNativeBodyInit(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  if (typeof ReadableStream !== 'undefined' && data instanceof ReadableStream) {
    return true;
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return true;
  }
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    return true;
  }
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    return true;
  }
  if (
    typeof URLSearchParams !== 'undefined' &&
    data instanceof URLSearchParams
  ) {
    return true;
  }
  return false;
}

function mergeHeaderValue(
  headers: Headers,
  key: string,
  value: string,
  overwrite: boolean,
): void {
  if (key.toLowerCase() === 'vary') {
    const existing = headers.get('Vary');
    if (!existing) {
      headers.set('Vary', value);
      return;
    }
    const parts = existing
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    for (const item of value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)) {
      if (!parts.some((p) => p.toLowerCase() === item.toLowerCase())) {
        parts.push(item);
      }
    }
    headers.set('Vary', parts.join(', '));
    return;
  }

  if (overwrite || !headers.has(key)) {
    headers.set(key, value);
  }
}

export class RouterWorkers {
  private method: string;
  private url: URL;
  private incrementRoute: string[] = [];
  private config?: ConfigWorker;
  private resolved: boolean = false;
  private routeParsers: Map<string, RouteParser> = new Map(); // Cache de parsers
  private pendingHeaders: Record<string, string> = {};
  private errorHandler?: ErrorHandler;
  private notFoundHandler?: NotFoundHandler;

  public req: Req;
  public response!: Response; // Será inicializado no res.send ou res.redirect
  public res: Res = {
    send: (data: any, config?: ResponseInit) => {
      if (typeof Response !== 'undefined' && data instanceof Response) {
        this.response = data;
      } else if (isNativeBodyInit(data)) {
        this.response = new Response(data as BodyInit, config);
      } else if (data !== null && typeof data == 'object') {
        this.response = Response.json(data, config);
      } else if (
        typeof data === 'string' &&
        this.config?.defaultResponseType === 'json'
      ) {
        const status = config?.status ?? 200;
        const payload = status >= 400 ? { error: data } : { message: data };
        this.response = Response.json(payload, config);
      } else {
        this.response = new Response(data, config);
      }
      this.resolved = true;
    },
    redirect: (url: string | URL, status?: number) => {
      this.response = Response.redirect(url, status);
      this.resolved = true;
    },

    // ✨ Response Helpers - Fase 3

    ok: <T = any>(data: T) => {
      this.response = Response.json(data, { status: 200 });
      this.resolved = true;
    },

    created: <T = any>(data: T, location?: string) => {
      const headers = location ? { Location: location } : undefined;
      this.response = Response.json(data, { status: 201, headers });
      this.resolved = true;
    },

    accepted: <T = any>(data?: T) => {
      this.response = Response.json(data || { message: 'Accepted' }, {
        status: 202,
      });
      this.resolved = true;
    },

    noContent: () => {
      this.response = new Response(null, { status: 204 });
      this.resolved = true;
    },

    badRequest: (error: string | { error: string; details?: any }) => {
      const body = typeof error === 'string' ? { error } : error;
      this.response = Response.json(body, { status: 400 });
      this.resolved = true;
    },

    unauthorized: (error?: string) => {
      this.response = Response.json(
        {
          error: error || 'Unauthorized',
        },
        { status: 401 },
      );
      this.resolved = true;
    },

    forbidden: (error?: string) => {
      this.response = Response.json(
        {
          error: error || 'Forbidden',
        },
        { status: 403 },
      );
      this.resolved = true;
    },

    notFound: (error?: string) => {
      this.response = Response.json(
        {
          error: error || 'Not Found',
        },
        { status: 404 },
      );
      this.resolved = true;
    },

    conflict: (error: string | { error: string; details?: any }) => {
      const body = typeof error === 'string' ? { error } : error;
      this.response = Response.json(body, { status: 409 });
      this.resolved = true;
    },

    unprocessable: (errors: any) => {
      this.response = Response.json(
        {
          error: 'Validation failed',
          issues: errors,
        },
        { status: 422 },
      );
      this.resolved = true;
    },

    serverError: (error?: string) => {
      this.response = Response.json(
        {
          error: error || 'Internal Server Error',
        },
        { status: 500 },
      );
      this.resolved = true;
    },

    json: <T = any>(data: T, status: number = 200) => {
      this.response = Response.json(data, { status });
      this.resolved = true;
    },

    html: (content: string, status: number = 200) => {
      this.response = new Response(content, {
        status,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
      this.resolved = true;
    },

    text: (content: string, status: number = 200) => {
      this.response = new Response(content, {
        status,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
      this.resolved = true;
    },

    stream: (stream: ReadableStream, config?: ResponseInit) => {
      this.response = new Response(stream, {
        status: config?.status ?? 200,
        statusText: config?.statusText,
        headers: config?.headers,
      });
      this.resolved = true;
    },

    sse: (stream: ReadableStream, headers?: Record<string, string>) => {
      this.response = new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          ...(headers || {}),
        },
      });
      this.resolved = true;
    },

    setHeader: (name: string, value: string) => {
      this.pendingHeaders[name] = value;
    },

    removeCache: async (pathname?: string) => {
      await this.removeCache(pathname);
    },
  };

  constructor(request: Request, config?: ConfigWorker) {
    this.url = new URL(request.url);
    this.method = request.method;
    this.config = config;
    this.req = new Request(request) as Req;
    this.req.pathname = this.url.pathname;
    this.req.queries = getQueryInPathName(this.url.search);
  }

  /**
   * Registra handler de erro global
   * Chamado automaticamente quando ocorre um erro não tratado
   */
  onError(handler: ErrorHandler): void {
    this.errorHandler = handler;
  }

  /**
   * Registra handler customizado para 404 (rota não encontrada)
   */
  notFound(handler: NotFoundHandler): void {
    this.notFoundHandler = handler;
  }

  /**
   * Registra middlewares globais
   * Executados antes de qualquer rota
   */
  async use(...args: Middleware[]) {
    for (let i = 0; i < args.length; i++) {
      const middleware = args[i];
      if (this.resolved) return;
      try {
        await middleware(this.req, this.res);
      } catch (error) {
        await this.handleError(error);
        return;
      }
    }
    return;
  }

  async get(...args: Args) {
    if (!this.resolved && this.method == 'GET' && this.isPathName(args[0])) {
      this.req.queries = getQueryInPathName(this.url.search);
      await this.foreachMiddleware(args);
      if (this.resolved) return;

      const cbResult = args[args.length - 1] as RouteHandler;
      let isPathNameInCache: boolean = false;

      for (const pathname of this.config?.cache?.pathname || []) {
        if (pathname.includes(',') && pathname.split(',')[0] == args[0]) {
          const pathNameAndTime = pathname.split(',');
          isPathNameInCache = pathNameAndTime[0] == args[0] ? true : false;
          if (this.config?.cache) {
            this.config.cache.maxage = pathNameAndTime[1];
          }
          break;
        } else if (pathname == args[0]) {
          isPathNameInCache = true;
          break;
        }
      }

      return isPathNameInCache
        ? await this.setCache(cbResult)
        : await this.executeHandler(cbResult);
    } else {
      this.incrementRoute.push(args[0]);
    }
  }

  async post(...args: Args) {
    if (!this.resolved && this.method == 'POST' && this.isPathName(args[0])) {
      try {
        this.req.bodyJson = await this.req.json();
      } catch {
        this.req.bodyJson = undefined;
      }
      await this.foreachMiddleware(args);
      if (this.resolved) return;
      const cbResult = args[args.length - 1] as RouteHandler;
      return await this.executeHandler(cbResult);
    } else {
      this.incrementRoute.push(args[0]);
    }
  }

  async put(...args: Args) {
    if (!this.resolved && this.method == 'PUT' && this.isPathName(args[0])) {
      try {
        this.req.bodyJson = await this.req.json();
      } catch {
        this.req.bodyJson = undefined;
      }
      await this.foreachMiddleware(args);
      if (this.resolved) return;
      await this.removeCache(args[0]);
      const cbResult = args[args.length - 1] as RouteHandler;
      return await this.executeHandler(cbResult);
    } else {
      this.incrementRoute.push(args[0]);
    }
  }

  async patch(...args: Args) {
    if (!this.resolved && this.method == 'PATCH' && this.isPathName(args[0])) {
      try {
        this.req.bodyJson = await this.req.json();
      } catch {
        this.req.bodyJson = undefined;
      }
      await this.foreachMiddleware(args);
      if (this.resolved) return;
      await this.removeCache(args[0]);
      const cbResult = args[args.length - 1] as RouteHandler;
      return await this.executeHandler(cbResult);
    } else {
      this.incrementRoute.push(args[0]);
    }
  }

  async delete(...args: Args) {
    if (!this.resolved && this.method == 'DELETE' && this.isPathName(args[0])) {
      await this.foreachMiddleware(args);
      if (this.resolved) return;
      await this.removeCache(args[0]);
      const cbResult = args[args.length - 1] as RouteHandler;
      return await this.executeHandler(cbResult);
    } else {
      this.incrementRoute.push(args[0]);
    }
  }

  async head(...args: Args) {
    if (!this.resolved && this.method == 'HEAD' && this.isPathName(args[0])) {
      await this.foreachMiddleware(args);
      if (this.resolved) return;
      const cbResult = args[args.length - 1] as RouteHandler;
      return await this.executeHandler(cbResult);
    } else {
      this.incrementRoute.push(args[0]);
    }
  }

  /**
   * Serve arquivos estáticos via binding `env.ASSETS` do Cloudflare Workers
   * Suporta filtros de prefixo, Cache-Control automático, headers customizados e guards de autenticação
   */
  async assets(binding?: AssetFetcher, options?: AssetsOptions): Promise<void> {
    if (this.resolved || !binding) return;
    try {
      const assetResponse = await handleStaticAssets(
        this.req,
        this.res,
        this.url.pathname,
        () => this.resolved,
        binding,
        options,
      );
      if (assetResponse && !this.resolved) {
        this.response = assetResponse;
        this.resolved = true;
      }
    } catch (error) {
      await this.handleError(error);
    }
  }

  /**
   * Verifica se o pathname da requisição corresponde à rota
   * Suporta rotas aninhadas: /api/users/:userId/posts/:postId
   */
  isPathName(path: string): boolean {
    // Rota sem parâmetros: comparação direta ou decodificada segmento a segmento
    if (!path.includes(':')) {
      if (matchStaticPath(this.url.pathname, path)) {
        this.req.params = undefined;
        this.req.param = undefined;
        return true;
      }
      return false;
    }

    // Rota com parâmetros (ou ':' literal) - usa RouteParser
    if (!this.routeParsers.has(path)) {
      this.routeParsers.set(path, new RouteParser(path));
    }

    const parser = this.routeParsers.get(path)!;
    const match = parser.match(this.url.pathname);

    if (match.matched) {
      // Injeta params no req (plural - mais intuitivo)
      this.req.params = match.params;
      // Mantém param para backward compatibility
      this.req.param = match.params;
      return true;
    }

    return false;
  }

  /**
   * Executa middlewares de rota com tratamento de erros
   */
  async foreachMiddleware(args: any[]) {
    for (let i = 1; i < args.length - 1; i++) {
      if (this.resolved) return;
      const middleware = args[i];
      try {
        await middleware(this.req, this.res);
      } catch (error) {
        await this.handleError(error);
        return;
      }
    }
    return;
  }

  /**
   * Executa handler de rota com tratamento de erros
   */
  private async executeHandler(handler: RouteHandler): Promise<void> {
    try {
      await handler(this.req, this.res);
    } catch (error) {
      await this.handleError(error);
    }
  }

  /**
   * Processa erros usando handler customizado ou padrão
   */
  private async handleError(error: any): Promise<void> {
    if (this.errorHandler) {
      try {
        await this.errorHandler(error, this.req, this.res);
      } catch {
        // Se o error handler falhar, usar resposta padrão
        this.res.send({ error: 'Internal Server Error' }, { status: 500 });
      }
      if (!this.response) {
        this.res.send({ error: 'Internal Server Error' }, { status: 500 });
      }
    } else {
      // Handler padrão
      const statusCode = error?.statusCode || 500;
      const message = error?.message || 'Internal Server Error';

      this.res.send({ error: message }, { status: statusCode });
    }
  }

  async setCache(callback: RouteHandler) {
    const cacheUrl = this.config?.cache?.version
      ? `${this.req.url}?v=${this.config.cache.version}`
      : this.req.url;
    const cacheKey = new Request(cacheUrl, { method: 'GET' });
    const response = await caches.default.match(cacheKey);

    if (!response) {
      await this.executeHandler(callback);
      if (this.response && this.response.ok) {
        this.response.headers.append(
          'Cache-Control',
          's-maxage=' + this.config!.cache!.maxage,
        );
        await caches.default.put(cacheKey, this.response.clone());
      }
      return;
    }

    // Preserva status, body e headers originais da resposta em cache
    this.response = response.clone();
    this.resolved = true;
    return;
  }

  private matchesCacheConfig(targetPath: string): boolean {
    const entries = this.config?.cache?.pathname;
    if (!entries || entries.length === 0) return false;

    for (const rawEntry of entries) {
      const entryPath = rawEntry.includes(',')
        ? rawEntry.split(',')[0]
        : rawEntry;

      if (entryPath === targetPath) {
        return true;
      }

      if (!entryPath.includes(':')) {
        if (matchStaticPath(targetPath, entryPath)) {
          return true;
        }
      } else {
        if (!this.routeParsers.has(entryPath)) {
          this.routeParsers.set(entryPath, new RouteParser(entryPath));
        }
        if (this.routeParsers.get(entryPath)!.match(targetPath).matched) {
          return true;
        }
      }
    }

    return false;
  }

  async removeCache(pathname?: string) {
    const targetPath = pathname || this.url.pathname;

    if (this.matchesCacheConfig(targetPath)) {
      const isConcreteTarget =
        !targetPath.includes(':') && targetPath !== this.url.pathname;
      const normalizedPath = targetPath.startsWith('/')
        ? targetPath
        : `/${targetPath}`;
      const baseUrl = isConcreteTarget
        ? `${this.url.origin}${normalizedPath}`
        : this.req.url;

      const cacheUrl = this.config?.cache?.version
        ? `${baseUrl}?v=${this.config.cache.version}`
        : baseUrl;
      const cacheKey = new Request(cacheUrl, { method: 'GET' });
      await caches.default.delete(cacheKey);
    }
    return;
  }

  /**
   * Resolve e retorna a Response final
   * Deve ser chamado como último método (return app.resolve())
   */
  resolve(): Response {
    if (!this.response) {
      // Usa handler customizado ou padrão para 404
      if (this.notFoundHandler) {
        try {
          this.notFoundHandler(this.req, this.res);
        } catch {
          // Fallback se o handler falhar
          this.res.send(
            { error: 'Not Found', path: this.url.pathname },
            { status: 404 },
          );
        }
      }

      if (!this.response) {
        // Handler padrão de 404 (ou fallback se notFoundHandler não enviou resposta)
        this.res.send(
          { error: 'Not Found', path: this.url.pathname },
          { status: 404 },
        );
      }
    }

    const corsHeaders = (this.req as any).__corsHeaders as
      | Record<string, string>
      | undefined;
    const hasPendingHeaders = Object.keys(this.pendingHeaders).length > 0;

    if ((corsHeaders || hasPendingHeaders) && this.response) {
      try {
        for (const [key, value] of Object.entries(this.pendingHeaders)) {
          mergeHeaderValue(this.response.headers, key, value, true);
        }
        if (corsHeaders) {
          for (const [key, value] of Object.entries(corsHeaders)) {
            mergeHeaderValue(this.response.headers, key, value, false);
          }
        }
      } catch {
        // Caso os headers da Response sejam imutáveis (ex: Response.redirect), clona com headers mutáveis
        const clonedHeaders = new Headers(this.response.headers);
        for (const [key, value] of Object.entries(this.pendingHeaders)) {
          mergeHeaderValue(clonedHeaders, key, value, true);
        }
        if (corsHeaders) {
          for (const [key, value] of Object.entries(corsHeaders)) {
            mergeHeaderValue(clonedHeaders, key, value, false);
          }
        }
        this.response = new Response(this.response.body, {
          status: this.response.status,
          statusText: this.response.statusText,
          headers: clonedHeaders,
        });
      }
    }

    return this.response as Response;
  }
}
