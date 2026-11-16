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
export declare function handleStaticAssets(req: Req, res: Res, pathname: string, isResolved: () => boolean, binding?: AssetFetcher, options?: AssetsOptions): Promise<Response | null>;
//# sourceMappingURL=assets.d.ts.map