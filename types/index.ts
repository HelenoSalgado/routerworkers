/**
 * Request estendida e mutável compartilhada entre middlewares, guards e controllers
 */
export interface Req extends Request {
  /** Pathname já extraído da URL da requisição */
  pathname?: string;
  queries?: Record<string, any>;
  params?: Record<string, string>; // Renomeado de 'param' para 'params' (plural, mais intuitivo)
  param?: Record<string, string>; // Mantido para backward compatibility
  bodyJson?: any;
  /** Permite anexar estados customizados em middlewares (ex: req.session, req.isNativeApp) */
  [key: string]: any;
}

/**
 * Response com métodos auxiliares
 */
export interface Res {
  send: (data: any, config?: ResponseInit) => void;
  redirect: (url: string | URL, status?: number) => void;

  // Response helpers (Fase 3)
  ok: <T = any>(data: T) => void;
  created: <T = any>(data: T, location?: string) => void;
  accepted: <T = any>(data?: T) => void;
  noContent: () => void;
  badRequest: (error: string | { error: string; details?: any }) => void;
  unauthorized: (error?: string) => void;
  forbidden: (error?: string) => void;
  notFound: (error?: string) => void;
  conflict: (error: string | { error: string; details?: any }) => void;
  unprocessable: (errors: any) => void;
  serverError: (error?: string) => void;
  json: <T = any>(data: T, status?: number) => void;
  html: (content: string, status?: number) => void;
  text: (content: string, status?: number) => void;

  // Streaming, Headers e Cache Helpers (v1.2.3)
  stream: (stream: ReadableStream, config?: ResponseInit) => void;
  sse: (stream: ReadableStream, headers?: Record<string, string>) => void;
  setHeader: (name: string, value: string) => void;
  removeCache: (pathname?: string) => Promise<void>;
}

/**
 * Handler de rota - função que processa a requisição
 */
export type RouteHandler = (req: Req, res: Res) => Promise<void> | void;

/**
 * Middleware - função que pode interceptar/modificar a requisição
 */
export type Middleware = (req: Req, res: Res) => Promise<void> | void;

/**
 * Argumentos de métodos de rota (path, middlewares opcionais, handler)
 */
export type Args = [
  pathname: string,
  ...middlewares: Middleware[],
  callback: RouteHandler,
];

/**
 * Handler de erro global
 */
export type ErrorHandler = (
  error: Error,
  req: Req,
  res: Res,
) => Promise<void> | void;

/**
 * Handler de 404 (rota não encontrada)
 */
export type NotFoundHandler = (req: Req, res: Res) => Promise<void> | void;

/**
 * Tipo padrão de resposta para res.send quando recebe string
 */
export type DefaultResponseType = 'json' | 'text';

/**
 * Configuração do RouterWorkers
 */
export type ConfigWorker = {
  defaultResponseType?: DefaultResponseType;
  cache?: {
    pathname: string[];
    maxage: string;
    version?: string;
  };
  cors?: {
    origin?: string | string[] | ((origin: string) => boolean);
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
  };
};

/**
 * Interface para Cache API do Cloudflare Workers
 */
export interface Caches {
  default: {
    delete(request: Request | URL): Promise<boolean>;
    has(cacheName: string): Promise<boolean>;
    keys(): Promise<string[]>;
    match(
      request: RequestInfo | URL,
      options?: MultiCacheQueryOptions,
    ): Promise<Response | undefined>;
    put(
      request: Request | URL,
      response: Response,
    ): Promise<Response | undefined>;
    open(cacheName: string): Promise<Cache>;
  };
}
