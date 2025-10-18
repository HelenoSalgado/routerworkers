/**
 * Route Groups para RouterWorkers
 * Permite agrupar rotas com prefixos e middlewares compartilhados
 */

import type { RouterWorkers } from "../index";
import type { Middleware } from "../../types/index";

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
export class RouteGroup {
    constructor(
        private app: RouterWorkers,
        private config: RouteGroupConfig = {}
    ) {}

    /**
     * Prefixo completo considerando grupos aninhados
     */
    private getFullPrefix(): string {
        return this.config.prefix || '';
    }

    /**
     * Combina middlewares do grupo com middlewares da rota
     */
    private combineMiddlewares(routeMiddlewares: Middleware[]): Middleware[] {
        const groupMiddlewares = this.config.middlewares || [];
        return [...groupMiddlewares, ...routeMiddlewares];
    }

    /**
     * Adiciona prefixo ao path
     */
    private prefixPath(path: string): string {
        const prefix = this.getFullPrefix();
        if (!prefix) return path;
        
        // Remove trailing slash do prefix e leading slash do path
        const cleanPrefix = prefix.replace(/\/$/, '');
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        
        return `${cleanPrefix}${cleanPath}`;
    }

    /**
     * Registra rota GET no grupo
     */
    async get(path: string, ...args: any[]): Promise<void> {
        const fullPath = this.prefixPath(path);
        const handler = args[args.length - 1];
        const routeMiddlewares = args.slice(0, -1);
        const allMiddlewares = this.combineMiddlewares(routeMiddlewares);
        
        await this.app.get(fullPath, ...allMiddlewares, handler);
    }

    /**
     * Registra rota POST no grupo
     */
    async post(path: string, ...args: any[]): Promise<void> {
        const fullPath = this.prefixPath(path);
        const handler = args[args.length - 1];
        const routeMiddlewares = args.slice(0, -1);
        const allMiddlewares = this.combineMiddlewares(routeMiddlewares);
        
        await this.app.post(fullPath, ...allMiddlewares, handler);
    }

    /**
     * Registra rota PUT no grupo
     */
    async put(path: string, ...args: any[]): Promise<void> {
        const fullPath = this.prefixPath(path);
        const handler = args[args.length - 1];
        const routeMiddlewares = args.slice(0, -1);
        const allMiddlewares = this.combineMiddlewares(routeMiddlewares);
        
        await this.app.put(fullPath, ...allMiddlewares, handler);
    }

    /**
     * Registra rota DELETE no grupo
     */
    async delete(path: string, ...args: any[]): Promise<void> {
        const fullPath = this.prefixPath(path);
        const handler = args[args.length - 1];
        const routeMiddlewares = args.slice(0, -1);
        const allMiddlewares = this.combineMiddlewares(routeMiddlewares);
        
        await this.app.delete(fullPath, ...allMiddlewares, handler);
    }

    /**
     * Cria um subgrupo aninhado
     */
    group(config: RouteGroupConfig, callback: (group: RouteGroup) => Promise<void>): Promise<void> {
        const nestedPrefix = this.getFullPrefix() + (config.prefix || '');
        const nestedMiddlewares = [
            ...(this.config.middlewares || []),
            ...(config.middlewares || [])
        ];

        const nestedGroup = new RouteGroup(this.app, {
            prefix: nestedPrefix,
            middlewares: nestedMiddlewares
        });

        return callback(nestedGroup);
    }
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
export async function group(
    app: RouterWorkers,
    config: RouteGroupConfig,
    callback: (group: RouteGroup) => Promise<void>
): Promise<void> {
    const routeGroup = new RouteGroup(app, config);
    await callback(routeGroup);
}
