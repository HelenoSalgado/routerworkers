/**
 * RouteParser - Parser simples e eficiente para rotas aninhadas
 * Converte rotas com parâmetros em regex para matching
 */

export interface RouteMatch {
  matched: boolean;
  params: Record<string, string>;
}

export class RouteParser {
  private pattern: RegExp;
  private paramNames: string[] = [];

  constructor(route: string) {
    // Extrai nomes dos parâmetros e cria pattern regex
    const regexPattern = route
      .replace(/\//g, '\\/') // Escapa barras
      .replace(/:(\w+)/g, (_, paramName) => {
        this.paramNames.push(paramName);
        return '([^\\/]+)'; // Captura qualquer coisa exceto /
      });

    this.pattern = new RegExp(`^${regexPattern}$`);
  }

  /**
   * Verifica se o pathname corresponde à rota e extrai parâmetros
   */
  match(pathname: string): RouteMatch {
    const matches = pathname.match(this.pattern);

    if (!matches) {
      return { matched: false, params: {} };
    }

    // Mapeia valores capturados para nomes dos parâmetros
    const params: Record<string, string> = {};
    this.paramNames.forEach((name, index) => {
      params[name] = decodeURIComponent(matches[index + 1]);
    });

    return { matched: true, params };
  }
}
