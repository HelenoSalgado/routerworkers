import fc from 'fast-check';
import { RouterWorkers, validate } from '../src/index';
import { safeDecodeURIComponent, RouteParser, matchStaticPath } from '../src/utils/routeParser';
import { Req, Res } from '../types/index';

// Configuração de iterações: rápido em desenvolvimento local, massivo em CI/Actions
const FUZZ_RUNS = process.env.FUZZ_RUNS
  ? parseInt(process.env.FUZZ_RUNS, 10)
  : process.env.CI
    ? 2000
    : 100;

describe(`Property-Based Fuzzing (${FUZZ_RUNS} runs por propriedade)`, () => {
  describe('Invariante 1: safeDecodeURIComponent e matchStaticPath nunca lançam exceção', () => {
    test('safeDecodeURIComponent nunca quebra com strings arbitrárias ou percent-encoding caótico', () => {
      fc.assert(
        fc.property(fc.string({ unit: 'grapheme' }), (input) => {
          const result = safeDecodeURIComponent(input);
          expect(result === null || typeof result === 'string').toBe(true);
        }),
        { numRuns: FUZZ_RUNS },
      );
    });

    test('Lida graciosamente com sequências malformadas de %', () => {
      const malformedPercentArb = fc
        .array(
          fc.oneof(
            fc.constant('%'),
            fc.constant('%2'),
            fc.constant('%zz'),
            fc.constant('%E0%A4'),
            fc.constant('%%'),
            fc.string(),
          ),
          { minLength: 1, maxLength: 8 },
        )
        .map((parts) => parts.join(''));

      fc.assert(
        fc.property(malformedPercentArb, (malformed) => {
          const result = safeDecodeURIComponent(malformed);
          expect(result === null || typeof result === 'string').toBe(true);
        }),
        { numRuns: FUZZ_RUNS },
      );
    });

    test('matchStaticPath nunca lança exceção com qualquer pathname arbitrário', () => {
      fc.assert(
        fc.property(
          fc.string({ unit: 'grapheme', maxLength: 50 }),
          fc.string({ unit: 'grapheme', maxLength: 50 }),
          (reqPath, routePath) => {
            expect(() => {
              matchStaticPath('/' + reqPath, '/' + routePath);
            }).not.toThrow();
          },
        ),
        { numRuns: FUZZ_RUNS },
      );
    });
  });

  describe('Invariante 2: RouteParser instancia e executa match com segurança', () => {
    test('Compilação e matching de rotas com caracteres arbitrários nunca quebram', () => {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 50 }),
          fc.string({ maxLength: 50 }),
          (routePattern, testPath) => {
            expect(() => {
              const parser = new RouteParser('/' + routePattern);
              const result = parser.match('/' + testPath);
              expect(typeof result.matched).toBe('boolean');
              expect(typeof result.params).toBe('object');
            }).not.toThrow();
          },
        ),
        { numRuns: FUZZ_RUNS },
      );
    });

    test('Extração de parâmetros com caracteres alfanuméricos válidos preserva o valor', () => {
      const safeIdArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,30}$/);

      fc.assert(
        fc.property(safeIdArb, (id) => {
          const parser = new RouteParser('/items/:id');
          const result = parser.match(`/items/${id}`);
          expect(result.matched).toBe(true);
          expect(result.params.id).toBe(id);
        }),
        { numRuns: FUZZ_RUNS },
      );
    });
  });

  describe('Invariante 3: RouterWorkers.resolve() nunca crasha com requisições arbitrárias', () => {
    test('Processamento de URLs caóticas (Unicode, metacaracteres, query arbitrária)', async () => {
      const arbitraryPathSegment = fc.oneof(
        fc.string({ maxLength: 20 }),
        fc.constantFrom(
          'users',
          'items',
          'café',
          'c++',
          'v1.0',
          'admin',
          '..',
          '.',
          'null',
          'undefined',
          '__proto__',
          'constructor',
        ),
      );

      const chaoticUrlArb = fc
        .tuple(
          fc.array(arbitraryPathSegment, { minLength: 1, maxLength: 4 }),
          fc.dictionary(fc.stringMatching(/^[a-zA-Z0-9_]{1,10}$/), fc.string({ maxLength: 15 })),
        )
        .map(([segments, queryObj]) => {
          const path = '/' + segments.map((s) => encodeURIComponent(s)).join('/');
          const query = new URLSearchParams(queryObj).toString();
          return `https://fuzz.worker.local${path}${query ? '?' + query : ''}`;
        });

      await fc.assert(
        fc.asyncProperty(chaoticUrlArb, async (url) => {
          let req: Request;
          try {
            req = new Request(url);
          } catch {
            return;
          }

          const app = new RouterWorkers(req);
          app.onError((err, _req, res) => res.serverError(err.message));

          await app.get('/users/:id', (r: Req, res: Res) => res.ok({ id: r.params?.id }));
          await app.get('/items/:category/:id', (r: Req, res: Res) => res.ok(r.params));
          await app.get('/v1.0/status', (_r: Req, res: Res) => res.ok({ status: 'ok' }));
          await app.get('/café', (_r: Req, res: Res) => res.ok({ café: true }));
          await app.get('*', (_r: Req, res: Res) => res.notFound('Not found'));

          const response = await app.resolve();
          expect(response).toBeInstanceOf(Response);
          expect([200, 400, 404, 500]).toContain(response.status);
        }),
        { numRuns: FUZZ_RUNS },
      );
    });
  });

  describe('Invariante 4: Proteção estrita contra Prototype Pollution', () => {
    test('Parâmetros ou queries com chaves perigosas não poluem Object.prototype', async () => {
      const dangerousKeys = fc.constantFrom(
        '__proto__',
        'constructor',
        'prototype',
        'toString',
        'valueOf',
      );

      await fc.assert(
        fc.asyncProperty(
          dangerousKeys,
          fc.stringMatching(/^[a-zA-Z0-9_-]{1,15}$/),
          async (key, value) => {
            const url = `https://fuzz.worker.local/test/${value}?${encodeURIComponent(key)}=polluted_val`;
            const req = new Request(url);
            const app = new RouterWorkers(req);

            await app.get('/test/:id', (r: Req, res: Res) => {
              return res.ok({
                paramValue: r.params?.id,
                query: r.queries,
              });
            });

            const res = await app.resolve();
            expect(res.status).toBe(200);

            // Invariante essencial: nenhum prototype deve conter resquícios
            expect((Object.prototype as any).polluted_val).toBeUndefined();
            expect((Object.prototype as any)[key]).not.toBe('polluted_val');
            expect(({} as any).polluted_val).toBeUndefined();
          },
        ),
        { numRuns: FUZZ_RUNS },
      );
    });
  });

  describe('Invariante 5: Validador de esquemas sob payloads arbitrários', () => {
    test('Validação de corpo JSON arbitrário não quebra o runtime nem vaza 500', async () => {
      const userSchema = {
        name: { type: 'string' as const, required: true },
        age: { type: 'number' as const, min: 18, max: 120 },
        tags: { type: 'array' as const },
      };

      const arbitraryJsonArb = fc.jsonValue();

      await fc.assert(
        fc.asyncProperty(arbitraryJsonArb, async (bodyPayload) => {
          const req = new Request('https://fuzz.worker.local/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload),
          });

          const app = new RouterWorkers(req);
          app.onError((err, _req, res) => res.serverError(err.message));

          await app.post('/submit', validate(userSchema), (r: Req, res: Res) => {
            return res.ok({ received: r.validatedBody });
          });

          const res = await app.resolve();
          expect([200, 400, 422]).toContain(res.status);
        }),
        { numRuns: FUZZ_RUNS },
      );
    });
  });
});
