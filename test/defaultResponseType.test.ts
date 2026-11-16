import { RouterWorkers } from '../src/index';
import type { Req, Res } from '../types/index';

describe('ConfigWorker - defaultResponseType', () => {
  test('Sem defaultResponseType (padrão em produção): res.send com string mantém resposta texto simples (retrocompatível)', async () => {
    const request = new Request('http://localhost/legacy');
    const app = new RouterWorkers(request);

    await app.get('/legacy', (_req: Req, res: Res) => {
      res.send('Texto puro legado', { status: 200 });
    });

    const response = app.resolve();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Texto puro legado');
  });

  test('defaultResponseType: "text" mantém string como texto simples', async () => {
    const request = new Request('http://localhost/text');
    const app = new RouterWorkers(request, { defaultResponseType: 'text' });

    await app.get('/text', (_req: Req, res: Res) => {
      res.send('Erro em texto', { status: 400 });
    });

    const response = app.resolve();
    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Erro em texto');
  });

  test('defaultResponseType: "json" formata string com status < 400 (ou omitido) como { message: data }', async () => {
    const request = new Request('http://localhost/ok');
    const app = new RouterWorkers(request, { defaultResponseType: 'json' });

    await app.get('/ok', (_req: Req, res: Res) => {
      res.send('Operação concluída com sucesso');
    });

    const response = app.resolve();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      message: 'Operação concluída com sucesso',
    });
  });

  test('defaultResponseType: "json" preserva status 201 e headers customizados ao formatar { message: data }', async () => {
    const request = new Request('http://localhost/created', { method: 'POST' });
    const app = new RouterWorkers(request, { defaultResponseType: 'json' });

    await app.post('/created', (_req: Req, res: Res) => {
      res.send('Recurso criado', {
        status: 201,
        headers: { 'X-Resource-Id': 'abc-123' },
      });
    });

    const response = app.resolve();
    expect(response.status).toBe(201);
    expect(response.headers.get('X-Resource-Id')).toBe('abc-123');
    expect(await response.json()).toEqual({ message: 'Recurso criado' });
  });

  test('defaultResponseType: "json" formata string com status >= 400 como { error: data }', async () => {
    const req400 = new Request('http://localhost/bad');
    const app400 = new RouterWorkers(req400, { defaultResponseType: 'json' });
    await app400.get('/bad', (_req: Req, res: Res) => {
      res.send('Parâmetro inválido', { status: 400 });
    });
    const res400 = app400.resolve();
    expect(res400.status).toBe(400);
    expect(await res400.json()).toEqual({ error: 'Parâmetro inválido' });

    const req500 = new Request('http://localhost/fail');
    const app500 = new RouterWorkers(req500, { defaultResponseType: 'json' });
    await app500.get('/fail', (_req: Req, res: Res) => {
      res.send('Falha interna no banco', { status: 500 });
    });
    const res500 = app500.resolve();
    expect(res500.status).toBe(500);
    expect(await res500.json()).toEqual({ error: 'Falha interna no banco' });
  });

  test('defaultResponseType: "json" não altera envio de objetos ou respostas 204 com null', async () => {
    const reqObj = new Request('http://localhost/obj');
    const appObj = new RouterWorkers(reqObj, { defaultResponseType: 'json' });
    await appObj.get('/obj', (_req: Req, res: Res) => {
      res.send({ custom: 'payload' }, { status: 200 });
    });
    const resObj = appObj.resolve();
    expect(resObj.status).toBe(200);
    expect(await resObj.json()).toEqual({ custom: 'payload' });

    const req204 = new Request('http://localhost/empty', { method: 'DELETE' });
    const app204 = new RouterWorkers(req204, { defaultResponseType: 'json' });
    await app204.delete('/empty', (_req: Req, res: Res) => {
      res.send(null, { status: 204 });
    });
    const res204 = app204.resolve();
    expect(res204.status).toBe(204);
  });
});
