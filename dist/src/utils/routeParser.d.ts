/**
 * RouteParser - Parser simples e eficiente para rotas aninhadas
 * Converte rotas com parâmetros em regex para matching
 */
export interface RouteMatch {
    matched: boolean;
    params: Record<string, string>;
}
export declare class RouteParser {
    private pattern;
    private paramNames;
    constructor(route: string);
    /**
     * Verifica se o pathname corresponde à rota e extrai parâmetros
     */
    match(pathname: string): RouteMatch;
}
//# sourceMappingURL=routeParser.d.ts.map