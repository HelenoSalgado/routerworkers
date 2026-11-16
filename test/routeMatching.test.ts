import {
  RouterWorkers,
  group,
  cors,
  corsProduction,
  validate,
} from '../src/index';
import {
  RouteParser,
  matchStaticPath,
  safeDecodeURIComponent,
} from '../src/utils/routeParser';
import { Req, Res } from '../types/index';

describe('Issue #4 - Reprodução Exata e Casos Principais', () => {
  async function handleIssue4Repro(
    url: string,
    withPlusRoute = false,
  ): Promise<Response> {
    const app = new RouterWorkers(new Request(url));
    app.onError((err, _req, res) => res.serverError(err.message));

    await app.get('/users/:id', (req: Req, res: Res) =>
      res.ok({ params: req.params }),
    );
    await app.get('/v1.0/items/:id', (req: Req, res: Res) =>
      res.ok({ params: req.params }),
    );
    await app.get('/files/:name.json', (req: Req, res: Res) =>
      res.ok({ params: req.params }),
    );
    await app.get('/café', (_req: Req, res: Res) => res.ok({ matched: true }));
    if (withPlusRoute) {
      await app.get('/c++/:id', (req: Req, res: Res) =>
        res.ok({ params: req.params }),
      );
    }

    return app.resolve();
  }

  test('Ponto literal em /v1.0/items/:id não deve fazer match em /v1x0/items/3', async () => {
    const resMiss = await handleIssue4Repro('https://w.example/v1x0/items/3');
    expect(resMiss.status).toBe(404);

    const resHit = await handleIssue4Repro('https://w.example/v1.0/items/3');
    expect(resHit.status).toBe(200);
    expect(await resHit.json()).toEqual({ params: { id: '3' } });
  });

  test('Ponto literal em /files/:name.json não deve fazer match em /files/reportxjson', async () => {
    const resMiss = await handleIssue4Repro(
      'https://w.example/files/reportxjson',
    );
    expect(resMiss.status).toBe(404);

    const resHit = await handleIssue4Repro(
      'https://w.example/files/report.json',
    );
    expect(resHit.status).toBe(200);
    expect(await resHit.json()).toEqual({ params: { name: 'report' } });
  });

  test('Percent-encoding malformado em /users/%E0%A4%A não deve lançar URIError e deve retornar 404', async () => {
    const res = await handleIssue4Repro('https://w.example/users/%E0%A4%A');
    expect(res.status).toBe(404);
  });

  test('Registrar /c++/:id deve escapar "+" literalmente e retornar 404 para /other sem SyntaxError', async () => {
    const resMiss = await handleIssue4Repro('https://w.example/other', true);
    expect(resMiss.status).toBe(404);

    const resHit = await handleIssue4Repro('https://w.example/c++/42', true);
    expect(resHit.status).toBe(200);
    expect(await resHit.json()).toEqual({ params: { id: '42' } });
  });

  test('Rota não-ASCII /café deve fazer match em https://w.example/café', async () => {
    const res = await handleIssue4Repro('https://w.example/café');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ matched: true });
  });
});

describe('Metacaracteres de RegExp e Segurança de Grupos de Captura', () => {
  test('Parênteses literais em /items/(v1)/:id não devem deslocar o índice de :id', async () => {
    const appMiss = new RouterWorkers(
      new Request('https://w.example/items/v1/999'),
    );
    await appMiss.get('/items/(v1)/:id', (req, res) =>
      res.ok({ params: req.params }),
    );
    expect(appMiss.resolve().status).toBe(404);

    const appHit = new RouterWorkers(
      new Request('https://w.example/items/(v1)/999'),
    );
    await appHit.get('/items/(v1)/:id', (req, res) =>
      res.ok({ params: req.params }),
    );
    const resHit = appHit.resolve();
    expect(resHit.status).toBe(200);
    expect(await resHit.json()).toEqual({ params: { id: '999' } });
  });

  test('Pipe "|" em /items/a|b/:id deve ser tratado literalmente e não permitir bypass de rota', async () => {
    const appBypass = new RouterWorkers(
      new Request('https://w.example/items/a/evil/bypass'),
    );
    await appBypass.get('/items/a|b/:id', (req, res) =>
      res.ok({ params: req.params }),
    );
    expect(appBypass.resolve().status).toBe(404);

    const appHit = new RouterWorkers(
      new Request('https://w.example/items/a|b/42'),
    );
    await appHit.get('/items/a|b/:id', (req, res) =>
      res.ok({ params: req.params }),
    );
    const resHit = appHit.resolve();
    expect(resHit.status).toBe(200);
    expect(await resHit.json()).toEqual({ params: { id: '42' } });
  });

  test('Colchetes, cifrão, circunflexo, asterisco e chaves em rotas devem ser literais', async () => {
    const parserBracket = new RouteParser('/items/[a]/:id');
    expect(parserBracket.match('/items/a/1').matched).toBe(false);
    expect(parserBracket.match('/items/[a]/1')).toEqual({
      matched: true,
      params: { id: '1' },
    });

    const parserMixedMeta = new RouteParser('/price/$100+:tax(v1)/:id');
    expect(parserMixedMeta.match('/price/$100+20(v1)/abc')).toEqual({
      matched: true,
      params: { tax: '20', id: 'abc' },
    });
    expect(parserMixedMeta.match('/price/$100+20v1/abc').matched).toBe(false);
  });

  test('Suporta múltiplos parâmetros no mesmo segmento e quebras de linha codificadas (%0A)', () => {
    const rangeParser = new RouteParser('/range/:from-:to');
    expect(rangeParser.match('/range/10-20')).toEqual({
      matched: true,
      params: { from: '10', to: '20' },
    });

    const extParser = new RouteParser('/files/:name.:ext');
    expect(extParser.match('/files/archive.tar.gz')).toEqual({
      matched: true,
      params: { name: 'archive.tar', ext: 'gz' },
    });

    const newlineParser = new RouteParser('/echo/:text');
    expect(newlineParser.match('/echo/hello%0Aworld')).toEqual({
      matched: true,
      params: { text: 'hello\nworld' },
    });

    const literalColonParser = new RouteParser('/time/12:00/:id');
    expect(literalColonParser.match('/time/12:00/abc')).toEqual({
      matched: true,
      params: { id: 'abc' },
    });
    expect(literalColonParser.match('/time/12:30/abc').matched).toBe(false);
  });
});

describe('Caminhos Não-ASCII, Percent-Encoding e Proteção contra Path Confusion', () => {
  test('Rota parametrizada não-ASCII /café/:id deve fazer match e decodificar parâmetros UTF-8', async () => {
    const app = new RouterWorkers(
      new Request('https://w.example/café/josé-123'),
    );
    await app.get('/café/:id', (req, res) => res.ok({ params: req.params }));

    const res = app.resolve();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ params: { id: 'josé-123' } });
  });

  test('Hexadecimal percent-encoded case-insensitive (/caf%c3%a9 vs /caf%C3%A9 vs /café)', () => {
    expect(matchStaticPath('/caf%c3%a9', '/café')).toBe(true);
    expect(matchStaticPath('/caf%C3%A9', '/café')).toBe(true);
    expect(matchStaticPath('/caf%c3%a9', '/caf%C3%A9')).toBe(true);
    expect(matchStaticPath('/caf%E0%A4%A', '/café')).toBe(false);
  });

  test('Barra codificada (%2F) em parâmetro deve ser preservada no valor e não dividir segmentos', () => {
    const parser = new RouteParser('/users/:id');
    expect(parser.match('/users/foo%2Fbar')).toEqual({
      matched: true,
      params: { id: 'foo/bar' },
    });

    expect(matchStaticPath('/a%2Fb', '/a/b')).toBe(false);
  });

  test('Não deve fazer double-decoding de %25 nem %252F', () => {
    const parser = new RouteParser('/users/:id');
    expect(parser.match('/users/100%25')).toEqual({
      matched: true,
      params: { id: '100%' },
    });
    expect(parser.match('/users/%252F')).toEqual({
      matched: true,
      params: { id: '%2F' },
    });
  });

  test('safeDecodeURIComponent retorna null para sequências malformadas', () => {
    expect(safeDecodeURIComponent('%E0%A4%A')).toBeNull();
    expect(safeDecodeURIComponent('%ZZ')).toBeNull();
    expect(safeDecodeURIComponent('100%')).toBeNull();
  });
});

describe('Regressão de Bugs Ocultos no RouterWorkers', () => {
  test('resolve() deve retornar 404 (e nunca undefined) quando o path existe apenas em outro método HTTP', async () => {
    const app = new RouterWorkers(
      new Request('https://w.example/users/123', { method: 'POST' }),
    );
    await app.get('/users/:id', (req, res) => res.ok({ params: req.params }));

    const res = app.resolve();
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(404);
    expect(app.req.params).toBeUndefined();
  });

  test('getQueryInPathName suporta chaves sem "=", valores com "=", UTF-8, "%" malformado e funciona em POST/use()', async () => {
    const appFlag = new RouterWorkers(
      new Request(
        'https://w.example/search?flag&q=café&token=a=b=c&bad=%E0%A4%A',
      ),
    );
    let queriesInMiddleware: any;
    await appFlag.use((req) => {
      queriesInMiddleware = req.queries;
    });
    await appFlag.get('/search', (req, res) =>
      res.ok({ queries: req.queries }),
    );

    const resFlag = appFlag.resolve();
    expect(resFlag.status).toBe(200);
    const body = await resFlag.json();
    expect(body).toEqual({
      queries: {
        flag: '',
        q: 'café',
        token: 'a=b=c',
        bad: '%E0%A4%A',
      },
    });
    expect(queriesInMiddleware).toEqual(body.queries);

    // Query vazia "?" não deve quebrar
    const appEmpty = new RouterWorkers(
      new Request('https://w.example/search?'),
    );
    await appEmpty.get('/search', (req, res) =>
      res.ok({ hasQueries: req.queries !== undefined }),
    );
    const resEmpty = appEmpty.resolve();
    expect(await resEmpty.json()).toEqual({ hasQueries: false });
  });

  test('RouteGroup aninhado deve normalizar barras duplicadas (/api/ + /v1/ + /users)', async () => {
    const app = new RouterWorkers(
      new Request('https://w.example/api/v1/users'),
    );
    await group(app, { prefix: '/api/' }, async (api) => {
      await api.group({ prefix: '/v1/' }, async (v1) => {
        await v1.get('/users', (_req, res) => res.ok({ matched: true }));
      });
    });

    const res = app.resolve();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ matched: true });
  });

  test('CORS deve bloquear origins não autorizadas em corsProduction e aplicar headers em GET/POST', async () => {
    // 1. Origin não autorizada não deve receber '*'
    const appBlocked = new RouterWorkers(
      new Request('https://w.example/test', {
        method: 'OPTIONS',
        headers: { Origin: 'https://attacker.example' },
      }),
    );
    await appBlocked.use(corsProduction(['https://trusted.example']));
    await appBlocked.get('/test', (_req, res) => res.ok({ ok: true }));
    const resBlocked = appBlocked.resolve();
    expect(resBlocked.headers.get('Access-Control-Allow-Origin')).toBeNull();

    // 2. Origin autorizada em requisição GET deve receber headers CORS na Response final
    const appAllowed = new RouterWorkers(
      new Request('https://w.example/test', {
        method: 'GET',
        headers: { Origin: 'https://trusted.example' },
      }),
    );
    await appAllowed.use(
      cors({
        origin: ['https://trusted.example'],
        credentials: true,
        exposedHeaders: ['X-Total-Count'],
      }),
    );
    await appAllowed.get('/test', (_req, res) => res.ok({ ok: true }));
    const resAllowed = appAllowed.resolve();
    expect(resAllowed.status).toBe(200);
    expect(resAllowed.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://trusted.example',
    );
    expect(resAllowed.headers.get('Access-Control-Allow-Credentials')).toBe(
      'true',
    );
    expect(resAllowed.headers.get('Access-Control-Expose-Headers')).toBe(
      'X-Total-Count',
    );
  });

  test('validate() deve rejeitar POST com body vazio ou GET sem queries quando há campos required', async () => {
    const appPost = new RouterWorkers(
      new Request('https://w.example/users', {
        method: 'POST',
        body: '',
      }),
    );
    await appPost.post(
      '/users',
      validate({ body: { email: { type: 'email', required: true } } }),
      (_req, res) => res.ok({ bypassed: true }),
    );
    const resPost = appPost.resolve();
    expect(resPost.status).toBe(400);

    const appGet = new RouterWorkers(new Request('https://w.example/users'));
    await appGet.get(
      '/users',
      validate({ queries: { page: { type: 'number', required: true } } }),
      (_req, res) => res.ok({ bypassed: true }),
    );
    const resGet = appGet.resolve();
    expect(resGet.status).toBe(400);
  });
});
