/**
 * RouteParser - Parser seguro e eficiente para rotas estáticas e parametrizadas
 * Opera segmento a segmento com suporte a UTF-8, escape de RegExp e proteção contra URIError
 */
export interface RouteMatch {
    matched: boolean;
    params: Record<string, string>;
}
/**
 * Verifica se uma chave pode causar prototype pollution.
 */
export declare function isDangerousKey(key: string): boolean;
/**
 * Decodifica um componente de URI com segurança, retornando null em caso de URIError.
 */
export declare function safeDecodeURIComponent(segment: string): string | null;
/**
 * Compara um pathname de requisição com uma rota estática (sem parâmetros),
 * decodificando segmento a segmento para suportar caracteres não-ASCII e
 * rejeitar sequências percentuais malformadas sem lançar exceções.
 */
export declare function matchStaticPath(requestPathname: string, routePath: string): boolean;
export declare class RouteParser {
    private readonly segments;
    constructor(route: string);
    private compileSegment;
    /**
     * Verifica se o pathname corresponde à rota e extrai parâmetros com segurança.
     */
    match(pathname: string): RouteMatch;
}
//# sourceMappingURL=routeParser.d.ts.map