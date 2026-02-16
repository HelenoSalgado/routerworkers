/**
 * CORS Middleware para RouterWorkers
 * Configuração flexível e compatível com Cloudflare Workers
 */
import type { Middleware } from '../../types/index';
/**
 * Configuração CORS
 */
export interface CorsOptions {
    /**
     * Origins permitidas
     * - string: origin específica ('https://example.com')
     * - string[]: múltiplas origins
     * - '*': qualquer origin (não recomendado para produção)
     * - function: validação customizada
     */
    origin?: string | string[] | ((origin: string) => boolean);
    /**
     * Métodos HTTP permitidos
     * @default ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
     */
    methods?: string[];
    /**
     * Headers permitidos na requisição
     * @default ['Content-Type', 'Authorization']
     */
    allowedHeaders?: string[];
    /**
     * Headers expostos na resposta
     */
    exposedHeaders?: string[];
    /**
     * Permitir credenciais (cookies, authorization headers)
     * @default false
     */
    credentials?: boolean;
    /**
     * Tempo de cache do preflight (em segundos)
     * @default 86400 (24 horas)
     */
    maxAge?: number;
}
/**
 * Cria middleware CORS
 *
 * @example
 * ```typescript
 * import { cors } from 'routerworkers';
 *
 * // CORS simples (permite tudo)
 * await app.use(cors());
 *
 * // CORS configurado
 * await app.use(cors({
 *   origin: 'https://example.com',
 *   credentials: true
 * }));
 * ```
 */
export declare function cors(options?: CorsOptions): Middleware;
/**
 * CORS preset para desenvolvimento (permite tudo)
 */
export declare function corsDevMode(): Middleware;
/**
 * CORS preset para produção (restritivo)
 */
export declare function corsProduction(allowedOrigins: string[]): Middleware;
//# sourceMappingURL=cors.d.ts.map