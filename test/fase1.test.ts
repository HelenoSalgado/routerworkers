import { RouterWorkers } from '../src/index';
import { Req, Res } from '../types/index';

describe('Fase 1 - Rotas Aninhadas', () => {
  test('Deve fazer match em rota com um parâmetro', async () => {
    const request = new Request('http://localhost/users/123');
    const app = new RouterWorkers(request);

    let capturedParams: any = null;
    await app.get('/users/:id', (req: Req, res: Res) => {
      capturedParams = req.params;
      res.send({ id: req.params?.id });
    });

    const _response = app.resolve();
    expect(capturedParams).toEqual({ id: '123' });
  });

  test('Deve fazer match em rota aninhada com múltiplos parâmetros', async () => {
    const request = new Request('http://localhost/api/users/123/posts/456');
    const app = new RouterWorkers(request);

    let capturedParams: any = null;
    await app.get('/api/users/:userId/posts/:postId', (req: Req, res: Res) => {
      capturedParams = req.params;
      res.send({ userId: req.params?.userId, postId: req.params?.postId });
    });

    const _response = app.resolve();
    expect(capturedParams).toEqual({ userId: '123', postId: '456' });
  });

  test('Deve fazer match em rota com 3 níveis de parâmetros', async () => {
    const request = new Request(
      'http://localhost/api/users/123/posts/456/comments/789',
    );
    const app = new RouterWorkers(request);

    let capturedParams: any = null;
    await app.get(
      '/api/users/:userId/posts/:postId/comments/:commentId',
      (req: Req, res: Res) => {
        capturedParams = req.params;
        res.send(req.params);
      },
    );

    const _response = app.resolve();
    expect(capturedParams).toEqual({
      userId: '123',
      postId: '456',
      commentId: '789',
    });
  });

  test('Deve manter backward compatibility com req.param', async () => {
    const request = new Request('http://localhost/users/123');
    const app = new RouterWorkers(request);

    let hasParam = false;
    let hasParams = false;

    await app.get('/users/:id', (req: Req, res: Res) => {
      hasParam = req.param !== undefined;
      hasParams = req.params !== undefined;
      res.send({ success: true });
    });

    app.resolve();
    expect(hasParam).toBe(true);
    expect(hasParams).toBe(true);
  });

  test('Não deve fazer match em rota diferente', async () => {
    const request = new Request('http://localhost/users/123/posts/456');
    const app = new RouterWorkers(request);

    let wasCalled = false;
    await app.get(
      '/api/users/:userId/comments/:commentId',
      (req: Req, res: Res) => {
        wasCalled = true;
        res.send({ success: true });
      },
    );

    app.resolve();
    expect(wasCalled).toBe(false);
  });
});

describe('Fase 1 - Tratamento de Erros', () => {
  test('Deve capturar erro em handler de rota', async () => {
    const request = new Request('http://localhost/test');
    const app = new RouterWorkers(request);

    let errorCaptured = false;
    app.onError((error, _req, res) => {
      errorCaptured = true;
      res.send({ error: error.message }, { status: 500 });
    });

    await app.get('/test', (_req: Req, _res: Res) => {
      throw new Error('Test error');
    });

    const _response = app.resolve();
    expect(errorCaptured).toBe(true);
  });

  test('Deve usar handler de erro padrão se não configurado', async () => {
    const request = new Request('http://localhost/test');
    const app = new RouterWorkers(request);

    await app.get('/test', (_req: Req, _res: Res) => {
      throw new Error('Test error');
    });

    const response = app.resolve();
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(response.status).toBe(500);
  });

  test('Deve capturar erro em middleware', async () => {
    const request = new Request('http://localhost/test');
    const app = new RouterWorkers(request);

    let errorCaptured = false;
    app.onError((error, _req, res) => {
      errorCaptured = true;
      res.send({ error: error.message }, { status: 500 });
    });

    const failingMiddleware = (_req: Req, _res: Res) => {
      throw new Error('Middleware error');
    };

    await app.get('/test', failingMiddleware, (req: Req, res: Res) => {
      res.send({ success: true });
    });

    const _response = app.resolve();
    expect(errorCaptured).toBe(true);
  });
});

describe('Fase 1 - Handler de 404', () => {
  test('Deve usar handler customizado de 404', () => {
    const request = new Request('http://localhost/nao-existe');
    const app = new RouterWorkers(request);

    let notFoundCalled = false;
    app.notFound((req, res) => {
      notFoundCalled = true;
      res.send({ error: 'Custom 404' }, { status: 404 });
    });

    app.get('/test', (req: Req, res: Res) => {
      res.send({ success: true });
    });

    const _response = app.resolve();
    expect(notFoundCalled).toBe(true);
  });

  test('Deve usar handler padrão de 404 se não configurado', () => {
    const request = new Request('http://localhost/nao-existe');
    const app = new RouterWorkers(request);

    app.get('/test', (req: Req, res: Res) => {
      res.send({ success: true });
    });

    const response = app.resolve();
    expect(response.status).toBe(404);
  });
});

describe('Fase 1 - Melhorias na Tipagem', () => {
  test('req.params deve estar disponível e tipado', () => {
    const request = new Request('http://localhost/users/123');
    const app = new RouterWorkers(request);

    app.get('/users/:id', (req: Req, res: Res) => {
      // TypeScript deve reconhecer req.params
      const id: string | undefined = req.params?.id;
      expect(typeof id).toBe('string');
      res.send({ id });
    });

    app.resolve();
  });

  test('req.queries deve estar disponível e tipado', () => {
    const request = new Request('http://localhost/search?q=test&page=1');
    const app = new RouterWorkers(request);

    app.get('/search', (req: Req, res: Res) => {
      // TypeScript deve reconhecer req.queries
      expect(req.queries).toBeDefined();
      expect(req.queries?.q).toBe('test');
      res.send({ query: req.queries?.q });
    });

    app.resolve();
  });
});
