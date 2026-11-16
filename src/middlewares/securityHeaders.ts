/**
 * Middleware de Security Headers para RouterWorkers
 * Aplica cabeçalhos defensivos padrão em respostas HTTP e Assets
 */

import type { Middleware, Req, Res } from '../../types/index';

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

export function securityHeaders(
  options: SecurityHeadersOptions = {},
): Middleware {
  const {
    noSniff = true,
    crossOriginResourcePolicy,
    frameOptions,
    referrerPolicy,
    strictTransportSecurity,
  } = options;

  return (_req: Req, res: Res) => {
    if (noSniff) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    if (crossOriginResourcePolicy) {
      res.setHeader('Cross-Origin-Resource-Policy', crossOriginResourcePolicy);
    }
    if (frameOptions) {
      res.setHeader('X-Frame-Options', frameOptions);
    }
    if (referrerPolicy) {
      res.setHeader('Referrer-Policy', referrerPolicy);
    }
    if (strictTransportSecurity) {
      res.setHeader('Strict-Transport-Security', strictTransportSecurity);
    }
  };
}
