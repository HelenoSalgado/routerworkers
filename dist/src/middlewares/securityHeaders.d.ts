/**
 * Middleware de Security Headers para RouterWorkers
 * Aplica cabeçalhos defensivos padrão em respostas HTTP e Assets
 */
import type { Middleware } from '../../types/index';
export interface SecurityHeadersOptions {
    /**
     * Define `X-Content-Type-Options: nosniff`
     * @default true
     */
    noSniff?: boolean;
    /**
     * Define `Cross-Origin-Resource-Policy`
     * Ex: 'cross-origin' | 'same-origin' | 'same-site'
     */
    crossOriginResourcePolicy?: 'same-origin' | 'same-site' | 'cross-origin';
    /**
     * Define `X-Frame-Options`
     * Ex: 'DENY' | 'SAMEORIGIN'
     */
    frameOptions?: 'DENY' | 'SAMEORIGIN';
    /**
     * Define `Referrer-Policy`
     * Ex: 'strict-origin-when-cross-origin' | 'no-referrer'
     */
    referrerPolicy?: string;
    /**
     * Define `Strict-Transport-Security`
     * Ex: 'max-age=31536000; includeSubDomains'
     */
    strictTransportSecurity?: string;
}
export declare function securityHeaders(options?: SecurityHeadersOptions): Middleware;
//# sourceMappingURL=securityHeaders.d.ts.map