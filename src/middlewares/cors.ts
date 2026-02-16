/**
 * CORS Middleware para RouterWorkers
 * Configuração flexível e compatível com Cloudflare Workers
 */

import type { Req, Res, Middleware } from '../../types/index';

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
export function cors(options: CorsOptions = {}): Middleware {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization'],
    exposedHeaders = [],
    credentials = false,
    maxAge = 86400,
  } = options;

  return async (req: Req, res: Res) => {
    const requestOrigin = req.headers.get('Origin') || '';

    // Determinar se a origin é permitida
    let allowOrigin = '*';

    if (typeof origin === 'string') {
      allowOrigin = origin;
    } else if (Array.isArray(origin)) {
      if (origin.includes(requestOrigin)) {
        allowOrigin = requestOrigin;
      }
    } else if (typeof origin === 'function') {
      if (origin(requestOrigin)) {
        allowOrigin = requestOrigin;
      }
    }

    // Se a requisição é OPTIONS (preflight), responder diretamente
    if (req.method === 'OPTIONS') {
      const headers = {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': methods.join(', '),
        'Access-Control-Allow-Headers': allowedHeaders.join(', '),
        'Access-Control-Max-Age': String(maxAge),
        ...(credentials ? { 'Access-control-Allow-Credentials': 'true' } : {}),
      };

      // Responder ao preflight com 204 No Content e os headers corretos
      res.send(null, { status: 204, headers });
      return;
    }

    // Para outras requisições, adicionar headers CORS à resposta
    // Guardamos as configs para aplicar depois quando a response for criada
    (req as any).__corsHeaders = {
      'Access-Control-Allow-Origin': allowOrigin,
      ...(credentials ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
      ...(exposedHeaders.length > 0
        ? { 'Access-Control-Expose-Headers': exposedHeaders.join(', ') }
        : {}),
    };
  };
}

/**
 * CORS preset para desenvolvimento (permite tudo)
 */
export function corsDevMode(): Middleware {
  return cors({
    origin: '*',
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  });
}

/**
 * CORS preset para produção (restritivo)
 */
export function corsProduction(allowedOrigins: string[]): Middleware {
  return cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });
}
