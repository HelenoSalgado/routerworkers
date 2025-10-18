/**
 * Request extendida com propriedades injetadas pelo RouterWorkers
 */
export interface Req extends Request {
    queries?: Record<string, any>;
    params?: Record<string, string>;
    param?: Record<string, string>;
    bodyJson?: any;
}
/**
 * Response com métodos auxiliares
 */
export interface Res {
    send: (data: any, config?: ResponseInit) => void;
    redirect: (url: string | URL, status?: number) => void;
    ok: (data: any) => void;
    created: (data: any, location?: string) => void;
    accepted: (data?: any) => void;
    noContent: () => void;
    badRequest: (error: string | {
        error: string;
        details?: any;
    }) => void;
    unauthorized: (error?: string) => void;
    forbidden: (error?: string) => void;
    notFound: (error?: string) => void;
    conflict: (error: string | {
        error: string;
        details?: any;
    }) => void;
    unprocessable: (errors: any) => void;
    serverError: (error?: string) => void;
    json: (data: any, status?: number) => void;
    html: (content: string, status?: number) => void;
    text: (content: string, status?: number) => void;
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
export type Args = [pathname: string, ...middlewares: Middleware[], callback: RouteHandler];
/**
 * Handler de erro global
 */
export type ErrorHandler = (error: Error, req: Req, res: Res) => Promise<void> | void;
/**
 * Handler de 404 (rota não encontrada)
 */
export type NotFoundHandler = (req: Req, res: Res) => Promise<void> | void;
/**
 * Configuração do RouterWorkers
 */
export type ConfigWorker = {
    cache?: {
        pathname: string[];
        maxage: string;
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
        match(request: RequestInfo | URL, options?: MultiCacheQueryOptions): Promise<Response | undefined>;
        put(request: Request | URL, response: Response): Promise<Response | undefined>;
        open(cacheName: string): Promise<Cache>;
    };
}
//# sourceMappingURL=index.d.ts.map