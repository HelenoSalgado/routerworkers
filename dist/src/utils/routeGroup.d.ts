/**
 * Route Groups para RouterWorkers
 * Permite agrupar rotas com prefixos e middlewares compartilhados
 */
import type { RouterWorkers } from '../index';
import type { Middleware } from '../../types/index';
/**
 * Configuração de um grupo de rotas
 */
export interface RouteGroupConfig {
    /**
     * Prefixo para todas as rotas do grupo
     * @example '/api/v1'
     */
    prefix?: string;
    /**
     * Middlewares aplicados a todas as rotas do grupo
     */
    middlewares?: Middleware[];
}
/**
 * Classe para gerenciar grupos de rotas
 */
export declare class RouteGroup {
    private app;
    private config;
    constructor(app: RouterWorkers, config?: RouteGroupConfig);
    /**
     * Prefixo completo considerando grupos aninhados
     */
    private getFullPrefix;
    /**
     * Combina middlewares do grupo com middlewares da rota
     */
    private combineMiddlewares;
    /**
     * Adiciona prefixo ao path
     */
    private prefixPath;
    /**
     * Registra rota GET no grupo
     */
    get(path: string, ...args: any[]): Promise<void>;
    /**
     * Registra rota POST no grupo
     */
    post(path: string, ...args: any[]): Promise<void>;
    /**
     * Registra rota PUT no grupo
     */
    put(path: string, ...args: any[]): Promise<void>;
    /**
     * Registra rota DELETE no grupo
     */
    delete(path: string, ...args: any[]): Promise<void>;
    /**
     * Cria um subgrupo aninhado
     */
    group(config: RouteGroupConfig, callback: (group: RouteGroup) => Promise<void>): Promise<void>;
}
/**
 * Cria um grupo de rotas
 *
 * @example
 * ```typescript
 * import { group } from 'routerworkers';
 *
 * await group(app, { prefix: '/api' }, async (api) => {
 *   await api.get('/users', handler);
 *   // Rota: GET /api/users
 * });
 * ```
 */
export declare function group(app: RouterWorkers, config: RouteGroupConfig, callback: (group: RouteGroup) => Promise<void>): Promise<void>;
//# sourceMappingURL=routeGroup.d.ts.map