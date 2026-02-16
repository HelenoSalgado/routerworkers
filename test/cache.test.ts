import { RouterWorkers } from '../src/index';
import type { Req, Res, ConfigWorker } from '../types/index';

// Mock da Cache API do Cloudflare
const cacheStore = new Map<string, Response>();

const mockCache = {
  default: {
    match: jest.fn(async (request: Request | string) => {
      const url = typeof request === 'string' ? request : request.url;
      return Promise.resolve(cacheStore.get(url));
    }),
    put: jest.fn(async (request: Request | string, response: Response) => {
      const url = typeof request === 'string' ? request : request.url;
      cacheStore.set(url, response.clone());
      return Promise.resolve(undefined);
    }),
  },
};

// Atribui o mock ao objeto global para que o RouterWorkers possa acessá-lo
Object.defineProperty(global, 'caches', {
  value: mockCache,
  writable: true,
});

describe('Cache com Invalidação por Versão', () => {
  beforeEach(() => {
    // Limpa o cache e os mocks antes de cada teste
    cacheStore.clear();
    jest.clearAllMocks();
  });

  const cacheConfig: ConfigWorker = {
    cache: {
      pathname: ['/data'],
      maxage: '3600', // 1 hora
      version: 'v1.0.0',
    },
  };

  test('Deve executar o handler e salvar no cache na primeira requisição (CACHE MISS)', async () => {
    const request = new Request('http://localhost/data');
    const app = new RouterWorkers(request, cacheConfig);

    const handler = jest.fn((_req: Req, res: Res) => {
      res.ok({ data: 'live data' });
    });

    await app.get('/data', handler);

    const response = app.resolve();
    expect(response.status).toBe(200);

    // 1. O handler da rota foi chamado
    expect(handler).toHaveBeenCalledTimes(1);

    // 2. A resposta foi salva no cache
    const expectedCacheKey = 'http://localhost/data?v=v1.0.0';
    expect(mockCache.default.put).toHaveBeenCalledTimes(1);
    expect(mockCache.default.put).toHaveBeenCalledWith(
      expect.objectContaining({ url: expectedCacheKey }),
      expect.any(Response),
    );

    // 3. A resposta contém os dados ao vivo
    const data = await response.json();
    expect(data).toEqual({ data: 'live data' });
  });

  test('Não deve executar o handler e deve servir do cache na segunda requisição (CACHE HIT)', async () => {
    const request = new Request('http://localhost/data');
    
    // Pre-popula o cache para simular um HIT
    const cachedResponse = new Response(JSON.stringify({ data: 'cached data' }));
    const cacheKey = 'http://localhost/data?v=v1.0.0';
    cacheStore.set(cacheKey, cachedResponse);

    const app = new RouterWorkers(request, cacheConfig);

    const handler = jest.fn((_req: Req, res: Res) => {
      res.ok({ data: 'live data' });
    });

    await app.get('/data', handler);
    
    // O routerworkers usa o res.send para retornar o cache, então a response não é setada diretamente
    // Temos que chamar resolve() para que o router encontre o cache
    const response = app.resolve();
    // A implementação do cache no routerworkers usa `res.send`, que é síncrono no nosso teste,
    // mas o `match` é assíncrono. Precisamos ajustar o teste.
    // O código original `return this.res.send(await response.json());` indica que o
    // `app.resolve()` não vai ter a resposta. A resposta é retornada pelo `get` diretamente.

    // A lógica de cache no RouterWorkers é um pouco diferente.
    // `await app.get()` vai resolver a response.

    // app.resolve() não deve ser necessário se a rota der match.
    // Vamos analisar a implementação do setCache
    // A response do cache é retornada por `res.send`, que no final das contas seta `this.response`.
    // Então, `app.resolve()` deve funcionar.

    expect(response.status).toBe(200);
    
    // 1. O handler da rota NÃO foi chamado
    expect(handler).not.toHaveBeenCalled();

    // 2. O cache foi lido
    expect(mockCache.default.match).toHaveBeenCalledTimes(1);
    expect(mockCache.default.match).toHaveBeenCalledWith(
        expect.objectContaining({ url: cacheKey })
    );

    // 3. A resposta contém os dados do cache
    const data = await response.json();
    expect(data).toEqual({ data: 'cached data' });
  });

  test('Deve executar o handler quando a versão do cache muda (CACHE INVALIDATION)', async () => {
    // Pre-popula o cache com a versão antiga
    const oldCachedResponse = new Response(JSON.stringify({ data: 'cached data v1' }));
    const oldCacheKey = 'http://localhost/data?v=v1.0.0';
    cacheStore.set(oldCacheKey, oldCachedResponse);
    
    // Cria uma nova request com uma nova configuração de versão
    const newCacheConfig: ConfigWorker = {
        ...cacheConfig,
        cache: {
            ...cacheConfig.cache!,
            version: 'v1.0.1', // Nova versão
        }
    };
    const request = new Request('http://localhost/data');
    const app = new RouterWorkers(request, newCacheConfig);

    const handler = jest.fn((_req: Req, res: Res) => {
      res.ok({ data: 'live data v2' });
    });

    await app.get('/data', handler);

    const response = app.resolve();
    expect(response.status).toBe(200);
    
    // 1. O handler foi chamado, pois a versão mudou
    expect(handler).toHaveBeenCalledTimes(1);

    // 2. O cache foi consultado com a nova chave
    const newCacheKey = 'http://localhost/data?v=v1.0.1';
    expect(mockCache.default.match).toHaveBeenCalledWith(
        expect.objectContaining({ url: newCacheKey })
    );
    
    // 3. O novo resultado foi salvo no cache
    expect(mockCache.default.put).toHaveBeenCalledWith(
        expect.objectContaining({ url: newCacheKey }),
        expect.any(Response)
    );
    
    // 4. A resposta contém os novos dados ao vivo
    const data = await response.json();
    expect(data).toEqual({ data: 'live data v2' });
  });
});
