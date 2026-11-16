/**
 * Route Groups para RouterWorkers
 * Permite agrupar rotas com prefixos e middlewares compartilhados
 */

import type { RouterWorkers } from '../index';
import type { Middleware, RouteHandler } from '../../types/index';

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
    private config: RouteGroupConfig = {},
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

    // Remove trailing slash do prefix e normaliza barra inicial do path
    const cleanPrefix = prefix.replace(/\/+$/, '');
    if (!path || path === '/') {
      return cleanPrefix || '/';
    }
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    return `${cleanPrefix}${cleanPath}`;
  }

  /**
   * Registra rota GET no grupo
   */
  async get(
    path: string,
    ...args: [...Middleware[], RouteHandler]
  ): Promise<void> {
    const fullPath = this.prefixPath(path);
    const handler = args[args.length - 1] as RouteHandler;
    const routeMiddlewares = args.slice(0, -1) as Middleware[];
    const allMiddlewares = this.combineMiddlewares(routeMiddlewares);

    await this.app.get(fullPath, ...allMiddlewares, handler);
  }

  /**
   * Registra rota POST no grupo
   */
  async post(
    path: string,
    ...args: [...Middleware[], RouteHandler]
  ): Promise<void> {
    const fullPath = this.prefixPath(path);
    const handler = args[args.length - 1] as RouteHandler;
    const routeMiddlewares = args.slice(0, -1) as Middleware[];
    const allMiddlewares = this.combineMiddlewares(routeMiddlewares);

    await this.app.post(fullPath, ...allMiddlewares, handler);
  }

  /**
   * Registra rota PUT no grupo
   */
  async put(
    path: string,
    ...args: [...Middleware[], RouteHandler]
  ): Promise<void> {
    const fullPath = this.prefixPath(path);
    const handler = args[args.length - 1] as RouteHandler;
    const routeMiddlewares = args.slice(0, -1) as Middleware[];
    const allMiddlewares = this.combineMiddlewares(routeMiddlewares);

    await this.app.put(fullPath, ...allMiddlewares, handler);
  }

  /**
   * Registra rota PATCH no grupo
   */
  async patch(
    path: string,
    ...args: [...Middleware[], RouteHandler]
  ): Promise<void> {
    const fullPath = this.prefixPath(path);
    const handler = args[args.length - 1] as RouteHandler;
    const routeMiddlewares = args.slice(0, -1) as Middleware[];
    const allMiddlewares = this.combineMiddlewares(routeMiddlewares);

    await this.app.patch(fullPath, ...allMiddlewares, handler);
  }

  /**
   * Registra rota DELETE no grupo
   */
  async delete(
    path: string,
    ...args: [...Middleware[], RouteHandler]
  ): Promise<void> {
    const fullPath = this.prefixPath(path);
    const handler = args[args.length - 1] as RouteHandler;
    const routeMiddlewares = args.slice(0, -1) as Middleware[];
    const allMiddlewares = this.combineMiddlewares(routeMiddlewares);

    await this.app.delete(fullPath, ...allMiddlewares, handler);
  }

  /**
   * Registra rota HEAD no grupo
   */
  async head(
    path: string,
    ...args: [...Middleware[], RouteHandler]
  ): Promise<void> {
    const fullPath = this.prefixPath(path);
    const handler = args[args.length - 1] as RouteHandler;
    const routeMiddlewares = args.slice(0, -1) as Middleware[];
    const allMiddlewares = this.combineMiddlewares(routeMiddlewares);

    await this.app.head(fullPath, ...allMiddlewares, handler);
  }

  /**
   * Cria um subgrupo aninhado
   */
  group(
    config: RouteGroupConfig,
    callback: (group: RouteGroup) => Promise<void>,
  ): Promise<void> {
    const nestedPrefix = config.prefix
      ? this.prefixPath(config.prefix)
      : this.getFullPrefix();
    const nestedMiddlewares = [
      ...(this.config.middlewares || []),
      ...(config.middlewares || []),
    ];

    const nestedGroup = new RouteGroup(this.app, {
      prefix: nestedPrefix,
      middlewares: nestedMiddlewares,
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
  callback: (group: RouteGroup) => Promise<void>,
): Promise<void> {
  const routeGroup = new RouteGroup(app, config);
  await callback(routeGroup);
}
