import { Args, ConfigWorker, Req, Res, ErrorHandler, NotFoundHandler, Middleware, RouteHandler } from '../types/index';
export { validate, schemas, ValidationError } from './utils/validator';
export type { ValidationRule, ValidationSchema, ValidateConfig, } from './utils/validator';
export { cors, corsDevMode, corsProduction } from './middlewares/cors';
export type { CorsOptions } from './middlewares/cors';
export { group, RouteGroup } from './utils/routeGroup';
export type { RouteGroupConfig } from './utils/routeGroup';
export declare class RouterWorkers {
    private method;
    private url;
    private incrementRoute;
    private config?;
    private resolved;
    private routeParsers;
    private errorHandler?;
    private notFoundHandler?;
    req: Req;
    response: Response;
    res: Res;
    constructor(request: Request, config?: ConfigWorker);
    /**
     * Registra handler de erro global
     * Chamado automaticamente quando ocorre um erro não tratado
     */
    onError(handler: ErrorHandler): void;
    /**
     * Registra handler customizado para 404 (rota não encontrada)
     */
    notFound(handler: NotFoundHandler): void;
    /**
     * Registra middlewares globais
     * Executados antes de qualquer rota
     */
    use(...args: Middleware[]): Promise<void>;
    get(...args: Args): Promise<void>;
    post(...args: Args): Promise<void>;
    put(...args: Args): Promise<void>;
    delete(...args: Args): Promise<void>;
    /**
     * Verifica se o pathname da requisição corresponde à rota
     * Suporta rotas aninhadas: /api/users/:userId/posts/:postId
     */
    isPathName(path: string): boolean;
    /**
     * Executa middlewares de rota com tratamento de erros
     */
    foreachMiddleware(args: any[]): Promise<void>;
    /**
     * Executa handler de rota com tratamento de erros
     */
    private executeHandler;
    /**
     * Processa erros usando handler customizado ou padrão
     */
    private handleError;
    setCache(callback: RouteHandler): Promise<void>;
    removeCache(pathname: string): Promise<void>;
    /**
     * Resolve e retorna a Response final
     * Deve ser chamado como último método (return app.resolve())
     */
    resolve(): Response;
}
//# sourceMappingURL=index.d.ts.map