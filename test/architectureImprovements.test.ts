import {
  RouterWorkers,
  group,
  cors,
  securityHeaders,
  type AssetFetcher,
  type Req,
  type Res,
} from '../src/index';

// Mock global caches para testes de invalidação dinâmica e cross-route
const deletedCacheUrls: string[] = [];
const mockCaches = {
  default: {
    match: jest.fn(async () => undefined),
    put: jest.fn(async () => undefined),
    delete: jest.fn(async (req: Request | URL) => {
      const url = typeof req === 'string' ? req : req.url || req.toString();
      deletedCacheUrls.push(url);
      return true;
    }),
  },
};

Object.defineProperty(global, 'caches', {
  value: mockCaches,
  writable: true,
});

describe('Melhorias Arquiteturais v1.2.3 - Static Assets (app.assets)', () => {
  const createMockAssets = (
    files: Record<
      string,
      { body: string; status?: number; headers?: Record<string, string> }
    >,
  ): AssetFetcher => ({
    fetch: jest.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? new URL(input)
          : input instanceof URL
            ? input
            : new URL(input.url);
      const item = files[url.pathname];
      if (!item) {
        return new Response('Asset Not Found', { status: 404 });
      }
      return new Response(item.body, {
        status: item.status ?? 200,
        headers: item.headers,
      });
    }),
  });

  test('Deve servir asset estático com Cache-Control imutável padrão e headers customizados', async () => {
    const assets = createMockAssets({
      '/covers/book-1.webp': {
        body: 'webp-binary-content',
        headers: { 'Content-Type': 'image/webp' },
      },
    });

    const app = new RouterWorkers(
      new Request('https://api.leiame.app/covers/book-1.webp'),
    );
    await app.use(
      securityHeaders({ crossOriginResourcePolicy: 'cross-origin' }),
    );
    await app.get('/api/health', (_req, res) => res.ok({ ok: true }));
    await app.assets(assets, { excludePrefixes: ['/api'] });

    const res = app.resolve();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('webp-binary-content');
    expect(res.headers.get('Cache-Control')).toBe(
      'public, max-age=604800, immutable',
    );
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe(
      'cross-origin',
    );
  });

  test('Deve proteger prefixos de assets com guards (ex: /content/*) compartilhando req mutável', async () => {
    const assets = createMockAssets({
      '/content/manuscrito.md': {
        body: '# Capítulo 1',
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      },
    });

    // 1. Sem autenticação -> 401 bloqueado pelo guard
    const appBlocked = new RouterWorkers(
      new Request('https://api.leiame.app/content/manuscrito.md'),
    );
    await appBlocked.assets(assets, {
      guards: [
        {
          prefix: '/content/',
          unauthorizedMessage:
            'Autenticação requerida para acessar o manuscrito.',
          authorize: (req) => req.headers.get('Authorization') === 'Bearer ok',
        },
      ],
    });
    const resBlocked = appBlocked.resolve();
    expect(resBlocked.status).toBe(401);
    expect(await resBlocked.json()).toEqual({
      error: 'Autenticação requerida para acessar o manuscrito.',
    });

    // 2. Com autenticação e mutação de req -> 200 liberado
    const appAllowed = new RouterWorkers(
      new Request('https://api.leiame.app/content/manuscrito.md', {
        headers: { Authorization: 'Bearer ok' },
      }),
    );
    let capturedPathname = '';
    await appAllowed.assets(assets, {
      guards: [
        {
          prefix: '/content/',
          authorize: (req) => {
            capturedPathname = req.pathname || '';
            req.userSession = { id: 'u1' };
            return req.headers.get('Authorization') === 'Bearer ok';
          },
        },
      ],
    });
    const resAllowed = appAllowed.resolve();
    expect(resAllowed.status).toBe(200);
    expect(await resAllowed.text()).toBe('# Capítulo 1');
    expect(capturedPathname).toBe('/content/manuscrito.md');
    expect(appAllowed.req.userSession).toEqual({ id: 'u1' });
  });

  test('Deve respeitar excludePrefixes e fallthroughOn404', async () => {
    const assets = createMockAssets({});

    const app = new RouterWorkers(
      new Request('https://api.leiame.app/api/missing'),
    );
    app.notFound((_req, res) => res.notFound('Rota da API inexistente'));
    await app.assets(assets, {
      excludePrefixes: ['/api'],
      fallthroughOn404: true,
    });

    const res = app.resolve();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Rota da API inexistente' });
    expect(assets.fetch).not.toHaveBeenCalled();
  });
});

describe('Melhorias Arquiteturais v1.2.3 - Streaming SSE, Binários e Response', () => {
  test('res.sse() deve configurar headers de Server-Sent Events e manter ReadableStream intacta', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"chunk":"Olá"}\n\n'));
        controller.close();
      },
    });

    const app = new RouterWorkers(
      new Request('https://api.leiame.app/api/chat', { method: 'POST' }),
    );
    await app.post('/api/chat', (_req, res) => {
      res.sse(stream);
    });

    const res = app.resolve();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(
      'text/event-stream; charset=utf-8',
    );
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(await res.text()).toBe('data: {"chunk":"Olá"}\n\n');
  });

  test('res.send() deve preservar ReadableStream, Uint8Array e Response sem chamar Response.json', async () => {
    const bytes = new Uint8Array([79, 75]);
    const appBin = new RouterWorkers(new Request('https://api.leiame.app/bin'));
    await appBin.get('/bin', (_req, res) => {
      res.send(bytes, {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    });
    const resBin = appBin.resolve();
    expect(resBin.status).toBe(200);
    expect(await resBin.text()).toBe('OK');

    const appRawRes = new RouterWorkers(
      new Request('https://api.leiame.app/raw'),
    );
    await appRawRes.get('/raw', (_req, res) => {
      res.send(new Response(' custom-response ', { status: 202 }));
    });
    const resRaw = appRawRes.resolve();
    expect(resRaw.status).toBe(202);
    expect(await resRaw.text()).toBe(' custom-response ');
  });
});

describe('Melhorias Arquiteturais v1.2.3 - Invalidação de Cache Dinâmico e Cross-Route', () => {
  beforeEach(() => {
    deletedCacheUrls.length = 0;
    jest.clearAllMocks();
  });

  test('res.removeCache deve invalidar rota parametrizada (/api/articles/:id/ratings) e rota distinta (/api/notifications)', async () => {
    const config = {
      cache: {
        pathname: ['/api/articles/:id/ratings,60', '/api/notifications,600'],
        maxage: '3600',
        version: 'deploy-v1',
      },
    };

    // 1. Chamando res.removeCache com ID concreto em rota parametrizada
    const app1 = new RouterWorkers(
      new Request('https://api.leiame.app/api/articles/art-99/ratings', {
        method: 'POST',
      }),
      config,
    );
    await app1.post('/api/articles/:id/ratings', async (req, res) => {
      await res.removeCache(`/api/articles/${req.params?.id}/ratings`);
      res.ok({ updated: true });
    });
    app1.resolve();
    expect(deletedCacheUrls).toContain(
      'https://api.leiame.app/api/articles/art-99/ratings?v=deploy-v1',
    );

    // 2. Chamando res.removeCache('/api/notifications') a partir de outra URL (/api/notifications/42/dismiss)
    const app2 = new RouterWorkers(
      new Request('https://api.leiame.app/api/notifications/42/dismiss', {
        method: 'POST',
      }),
      config,
    );
    await app2.post('/api/notifications/:id/dismiss', async (_req, res) => {
      await res.removeCache('/api/notifications');
      res.ok({ dismissed: true });
    });
    app2.resolve();
    expect(deletedCacheUrls).toContain(
      'https://api.leiame.app/api/notifications?v=deploy-v1',
    );
  });
});

describe('Melhorias Arquiteturais v1.2.3 - Vary: Origin, res.setHeader, req.pathname e PATCH/HEAD', () => {
  test('cors() com origin dinâmica deve incluir Vary: Origin e mesclar com res.setHeader', async () => {
    const app = new RouterWorkers(
      new Request('https://api.leiame.app/api/items', {
        method: 'PATCH',
        headers: { Origin: 'https://leiame.app' },
        body: JSON.stringify({ title: 'Novo Título' }),
      }),
    );

    await app.use(
      cors({
        origin: ['https://leiame.app'],
        credentials: true,
      }),
      securityHeaders({ frameOptions: 'DENY' }),
    );

    await group(app, { prefix: '/api' }, async (api) => {
      await api.patch('/items', (req: Req, res: Res) => {
        res.setHeader('Vary', 'Accept-Encoding');
        res.ok({
          pathname: req.pathname,
          updatedTitle: req.bodyJson?.title,
        });
      });

      await api.head('/items', (_req: Req, res: Res) => {
        res.noContent();
      });
    });

    const res = app.resolve();
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://leiame.app',
    );
    expect(res.headers.get('Vary')).toBe('Accept-Encoding, Origin');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(await res.json()).toEqual({
      pathname: '/api/items',
      updatedTitle: 'Novo Título',
    });

    // Verifica método HEAD no RouteGroup
    const appHead = new RouterWorkers(
      new Request('https://api.leiame.app/api/items', { method: 'HEAD' }),
    );
    await group(appHead, { prefix: '/api' }, async (api) => {
      await api.head('/items', (_req, res) => res.noContent());
    });
    expect(appHead.resolve().status).toBe(204);
  });
});
