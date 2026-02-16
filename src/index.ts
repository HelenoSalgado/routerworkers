import {
  Args,
  Caches,
  ConfigWorker,
  Req,
  Res,
  ErrorHandler,
  NotFoundHandler,
  Middleware,
  RouteHandler,
} from '../types/index';
import { getQueryInPathName } from './utils/getQueries';
import { RouteParser } from './utils/routeParser';

// Exportar validador built-in
export { validate, schemas, ValidationError } from './utils/validator';
export type {
  ValidationRule,
  ValidationSchema,
  ValidateConfig,
} from './utils/validator';

// Exportar CORS middleware
export { cors, corsDevMode, corsProduction } from './middlewares/cors';
export type { CorsOptions } from './middlewares/cors';

// Exportar Route Groups
export { group, RouteGroup } from './utils/routeGroup';
export type { RouteGroupConfig } from './utils/routeGroup';

declare const caches: Caches;

export class RouterWorkers {
  private method: string;
  private url: URL;
  private incrementRoute: string[] = [];
  private config?: ConfigWorker;
  private resolved: boolean = false;
  private routeParsers: Map<string, RouteParser> = new Map(); // Cache de parsers
  private errorHandler?: ErrorHandler;
  private notFoundHandler?: NotFoundHandler;

  public req: Req;
  public response!: Response; // Será inicializado no res.send ou res.redirect
  public res: Res = {
    send: (data: any, config?: ResponseInit) => {
      if (data !== null && typeof data == 'object') {
        this.response = Response.json(data, config);
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

    ok: (data: any) => {
      this.response = Response.json(data, { status: 200 });
      this.resolved = true;
    },

    created: (data: any, location?: string) => {
      const headers = location ? { Location: location } : undefined;
      this.response = Response.json(data, { status: 201, headers });
      this.resolved = true;
    },

    accepted: (data?: any) => {
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

    json: (data: any, status: number = 200) => {
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
  };

  constructor(request: Request, config?: ConfigWorker) {
    this.url = new URL(request.url);
    this.method = request.method;
    this.config = config;
    this.req = new Request(request) as Req;
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

  /**
   * Verifica se o pathname da requisição corresponde à rota
   * Suporta rotas aninhadas: /api/users/:userId/posts/:postId
   */
  isPathName(path: string): boolean {
    // Rota exata (sem parâmetros)
    if (this.url.pathname === path) {
      return true;
    }

    // Rota com parâmetros - usa RouteParser
    if (path.includes(':')) {
      // Reutiliza parser se já existe (performance)
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
    } else {
      // Handler padrão
      const statusCode = error.statusCode || 500;
      const message = error.message || 'Internal Server Error';

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

    // Retorna resposta em cache
    return this.res.send(await response.json());
  }

  async removeCache(pathname: string) {
    if (
      this.config?.cache?.pathname &&
      this.config.cache.pathname.length > 0 &&
      this.config.cache.pathname.includes(pathname)
    ) {
      const cacheUrl = this.config?.cache?.version
        ? `${this.req.url}?v=${this.config.cache.version}`
        : this.req.url;
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
      // Verifica se alguma rota corresponde ao pathname
      const matched = this.incrementRoute.some((pathname) =>
        this.isPathName(pathname),
      );

      if (!matched) {
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
        } else {
          // Handler padrão de 404
          this.res.send(
            { error: 'Not Found', path: this.url.pathname },
            { status: 404 },
          );
        }
      }
    }

    return this.response as Response;
  }
}

// Middlewares
// export function expurgCache(req: Req, res: Res){
//     let cacheKey = new Request(req.url, {method: 'GET'});
//     caches.default.delete(cacheKey);
// }
