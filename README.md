# RouterWorkers

<div align="center">

[![npm version](https://img.shields.io/npm/v/routerworkers.svg)](https://www.npmjs.com/package/routerworkers)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)

**Um roteador moderno, minimalista e poderoso para Cloudflare Workers**

[Instalação](#-instalação) • [Início Rápido](#-início-rápido) • [Documentação](#-documentação) • [Exemplos](#-exemplos)

</div>

---
## 📋 Índice

- [🌟 Features](#-features)
- [📦 Instalação](#-instalação)
- [🚀 Início Rápido](#-início-rápido)
- [📖 Documentação](#-documentação)
  - [Response Helpers](#response-helpers)
  - [Route Groups](#route-groups)
  - [CORS](#cors)
  - [Validação](#validação)
  - [Rotas Aninhadas](#rotas-aninhadas)
  - [Middlewares](#middlewares)
  - [Error Handlers](#error-handlers)
  - [Cache com Invalidação Automática](#cache-com-invalidação-automática)
- [📝 Exemplos](#-exemplos)
- [🛠️ Tecnologias](#-tecnologias)
- [📄 Licença](#-licença)
- [🔗 Links](#-links)

---

## 🌟 Features

- ✅ **Zero Dependências** - Bundle minimalista (~29KB)
- ✅ **TypeScript First-class** - Tipos completos e inferência automática
- ✅ **Response Helpers** - 14 métodos semânticos (ok, created, notFound, etc)
- ✅ **Route Groups** - Organize rotas com prefixos e middlewares compartilhados
- ✅ **CORS Built-in** - Middleware CORS completo e configurável
- ✅ **Validação Built-in** - Validador de schemas sem dependências
- ✅ **Rotas Aninhadas** - Suporte completo (`/users/:id/posts/:postId`)
- ✅ **Error Handlers** - Tratamento customizado de erros e 404
- ✅ **Cache API** - Integração nativa com Cloudflare Cache
- ✅ **Middlewares** - Globais e por rota

---

## 📦 Instalação

```bash
npm install routerworkers
```

---

## 🚀 Início Rápido

### Hello World

```typescript
import { RouterWorkers } from 'routerworkers';
import type { Req, Res } from 'routerworkers';

export default {

    async fetch(request: Request): Promise<Response> {

        const app = new RouterWorkers(request);

        await app.get('/', (req: Req, res: Res) => {
            res.ok({ message: 'Hello World!' });
        });

        return app.resolve();
    }

};
```

### Exemplo Prático

```typescript
import { RouterWorkers, validate } from 'routerworkers';
import type { Req, Res } from 'routerworkers';

export default {

    async fetch(request: Request): Promise<Response> {

        const app = new RouterWorkers(request);

        // Rota com validação de body
        await app.post('/users',
            validate({
                body: {
                    name: { type: 'string', required: true },
                    email: { type: 'email', required: true }
                }
            }),
            (req: Req, res: Res) => {
                const newUser = req.bodyJson;
                // Lógica para criar usuário...
                res.created({ user: newUser });
            }
        );

        // Handler para rotas não encontradas
        app.notFound((_req, res) => res.notFound('Oops! Rota não encontrada.'));

        return app.resolve();
    }
};
```

---

## 📖 Documentação

### Response Helpers

RouterWorkers oferece 14 métodos semânticos para respostas HTTP:

#### Success (2xx)

```typescript
// 200 OK
res.ok({ users: [] });

// 201 Created
res.created({ id: '123' }, '/users/123');

// 202 Accepted
res.accepted({ jobId: '456', status: 'processing' });

// 204 No Content
res.noContent();
```

#### Client Errors (4xx)

```typescript
// 400 Bad Request
res.badRequest('Email is required');

// 401 Unauthorized
res.unauthorized('Token required');

// 403 Forbidden
res.forbidden('Admin access required');

// 404 Not Found
res.notFound('User not found');

// 409 Conflict
res.conflict('Email already exists');

// 422 Unprocessable Entity
res.unprocessable([{ field: 'email', message: 'Invalid' }]);
```

#### Server Errors (5xx)

```typescript
// 500 Internal Server Error
res.serverError('Something went wrong');
```

#### Custom

```typescript
// JSON customizado
res.json({ custom: true }, 418);

// HTML
res.html('<h1>Hello</h1>');

// Text
res.text('Plain text');
```

---

### Route Groups

Organize rotas com prefixos e middlewares compartilhados:

```typescript
import { group } from 'routerworkers';

await group(app, { prefix: '/api' }, async (api) => {
    
    // GET /api/users
    await api.get('/users', handler);
    
    // POST /api/users
    await api.post('/users', handler);
});
```

#### Com Middlewares

```typescript
const authMiddleware = async (req, res) => {
    if (!req.headers.get('Authorization')) {
        res.unauthorized();
    }
};

await group(app, { 
    prefix: '/api',
    middlewares: [authMiddleware]
}, async (api) => {
    // Todas as rotas aqui exigem autenticação
});
```

#### Grupos Aninhados

```typescript
await group(app, { prefix: '/api' }, async (api) => {
    await api.group({ prefix: '/v1' }, async (v1) => {
        await v1.group({ prefix: '/users' }, async (users) => {
            // GET /api/v1/users
            await users.get('/', handler);
            // GET /api/v1/users/:id
            await users.get('/:id', handler);
        });
    });
});
```

---

### CORS

#### Desenvolvimento (permite tudo)

```typescript
import { corsDevMode } from 'routerworkers';

await app.use(corsDevMode());
```

#### Produção

```typescript
import { corsProduction } from 'routerworkers';

await app.use(corsProduction([
    'https://example.com',
    'https://app.example.com'
]));
```

#### Customizado

```typescript
import { cors } from 'routerworkers';

await app.use(cors({
    origin: 'https://example.com', // ou array ou function
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400
}));
```

---

### Validação

RouterWorkers inclui um validador built-in completo:

```typescript
import { validate, schemas } from 'routerworkers';

// Validação de body
await app.post('/users',
    validate({
        body: {
            name: { type: 'string', required: true, minLength: 3 },
            email: { type: 'email', required: true },
            age: { type: 'number', min: 18, max: 120 }
        }
    }),
    (req, res) => {
        // req.bodyJson já está validado
        res.created(req.bodyJson);
    }
);

// Validação de params
await app.get('/users/:id',
    validate({ params: { id: schemas.uuid } }),
    (req, res) => {
        res.ok({ user: { id: req.params!.id } });
    }
);

// Validação de queries
await app.get('/users',
    validate({ queries: schemas.pagination }),
    (req, res) => {
        const { page = 1, limit = 10 } = req.queries || {};
        res.ok({ users: [], page, limit });
    }
);
```

#### Schemas Pré-definidos

```typescript
schemas.uuid         // UUID válido
schemas.email        // Email válido
schemas.url          // URL válida
schemas.pagination   // { page?: { type: 'number', min: 1 }, limit?: { type: 'number', min: 1, max: 100 } }
```

---

### Rotas Aninhadas

```typescript
// Suporte completo a rotas aninhadas
await app.get('/users/:userId/posts/:postId', (req, res) => {
    const { userId, postId } = req.params!;
    res.ok({ userId, postId });
});
```

---

### Middlewares

#### Global

```typescript
await app.use(async (req, res) => {
    console.log(`${req.method} ${req.url}`);
});
```

#### Por Rota

```typescript
const authMiddleware = async (req, res) => {
    if (!req.headers.get('Authorization')) {
        res.unauthorized();
    }
};

await app.get('/protected', authMiddleware, (req, res) => {
    res.ok({ protected: true });
});
```

---

### Error Handlers

```typescript
// Handler de erros customizado
app.onError((error, req, res) => {
    console.error('[ERROR]', error);
    res.serverError(error.message);
});

// Handler 404 customizado
app.notFound((req, res) => {
    res.notFound(`Route ${req.url} not found`);
});
```

---

### Cache com Invalidação Automática

O RouterWorkers oferece integração nativa com a [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) da Cloudflare, com uma solução robusta para o problema de invalidação de cache entre deploys.

#### O Problema: Cache Persistente

Por padrão, o cache da Cloudflare é persistente. Se você fizer um novo deploy com alterações no código, as respostas para rotas cacheadas podem continuar vindo da versão antiga (em cache), pois a chave do cache (a URL da rota) não mudou. A solução comum, mas tediosa, é adicionar manualmente um número de versão.

#### A Solução: Versionamento Automático

A solução ideal é usar um identificador único para cada deploy como parte da chave do cache. O RouterWorkers faz isso de forma transparente quando configurado corretamente com o ambiente da Cloudflare.

**Passo 1: Configure seu `wrangler.toml`**

Adicione a seguinte configuração ao seu `wrangler.toml` para que a Cloudflare injete os metadados da versão do seu Worker na variável de ambiente `CF_VERSION_METADATA`.

```toml
# wrangler.toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2023-10-26"

# Habilita a injeção dos metadados da implantação
[version_metadata]
binding = "CF_VERSION_METADATA"
```

**Passo 2: Use o ID da Versão na Configuração**

No seu código, passe o ID da versão (`env.CF_VERSION_METADATA.id`) para a configuração do RouterWorkers. Ele será usado para criar uma chave de cache única para o deploy atual.

```typescript
// src/index.ts
import { RouterWorkers } from 'routerworkers';
import type { Req, Res, ConfigWorker } from 'routerworkers';

// Defina a interface para o seu ambiente
interface Env {
    CF_VERSION_METADATA: {
        id: string;
        timestamp: string;
        tag: string;
    };
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {

        // Obtenha o ID único do deploy
        const deploymentId = env.CF_VERSION_METADATA.id;

        // Configure o cache com o ID de versionamento
        const config: ConfigWorker = {
            cache: {
                pathname: ['/data'],      // A rota que queremos cachear
                maxage: '3600',           // Tempo de vida do cache (1 hora)
                version: deploymentId     // Chave de versionamento automático!
            }
        };

        const app = new RouterWorkers(request, config);

        // Esta rota será cacheada automaticamente por deploy
        await app.get('/data', (req: Req, res: Res) => {
            console.log('Executando a lógica da rota (não veio do cache)');
            res.ok({
                message: 'Estes são dados frescos, servidos diretamente pela função.',
                deploymentId: deploymentId
            });
        });

        return app.resolve();
    }
};
```

Com essa configuração, a cada novo `wrangler deploy`, o `deploymentId` muda, o cache antigo é automaticamente ignorado e seu Worker servirá a nova versão, que será então cacheada.

---

### `defaultResponseType` no `ConfigWorker`

Para APIs JSON que utilizam `res.send('mensagem')`, é possível configurar `defaultResponseType: 'json'` para converter automaticamente strings em payloads JSON estruturados (`{ message: data }` para status `< 400` e `{ error: data }` para status `>= 400`):

```typescript
const app = new RouterWorkers(request, { defaultResponseType: 'json' });

await app.get('/status', (_req, res) => {
    res.send('Serviço operacional'); // 200 -> { "message": "Serviço operacional" }
});

await app.get('/erro', (_req, res) => {
    res.send('Acesso negado', { status: 403 }); // 403 -> { "error": "Acesso negado" }
});
```

> **Compatibilidade:** Quando `defaultResponseType` é omitido (padrão), `res.send('texto')` mantém o comportamento original retornando texto plano (`text/plain`).

---

## 📦 Notas da Versão `1.2.2` (Compatibilidade e Segurança)

- **Matching de rotas e RegExp (Issue #4):** Rotas agora são compiladas e validadas segmento a segmento, escapando metacaracteres de expressão regular (`.`, `+`, `*`, `?`, `()`, `[]`, `|`, etc.), suportando caminhos não-ASCII (`/café`, `/café/:id`) e tratando sequências percentuais malformadas (`%E0%A4%A`) com retorno seguro `404` em vez de lançar `URIError`.
- **Nomes de parâmetros de rota (`/:([a-zA-Z_]\w*)/g`):** Parâmetros dinâmicos devem iniciar com letra ou underscore (ex.: `:id`, `:userId`, `:_slug`), permitindo que dois-pontos seguidos de dígitos em segmentos de URL (ex.: `/time/12:00`) sejam tratados literalmente.
- **CORS restritivo (`corsProduction` / `origin` por lista ou função):** Origens não autorizadas não recebem mais fallback `*`, e os cabeçalhos CORS configurados são aplicados automaticamente na `Response` final em `app.resolve()`.
- **Validação obrigatória (`validate`):** Campos marcados com `required: true` em `body` ou `queries` agora são validados mesmo quando a requisição chega com corpo vazio ou sem query string.

---

## 📝 Exemplos

Veja a pasta [`examples/`](./examples) para exemplos completos:

- [Fase 1 - Rotas Aninhadas](./examples/fase1-example.ts)
- [Fase 2A - Validação](./examples/fase2a-example.ts)
- [Fase 3 - Response Helpers + Groups + CORS](./examples/fase3-example.ts)

---


## 🛠️ Tecnologias

- TypeScript 5.9+
- Cloudflare Workers
- Rollup (build)
- Jest (testes)

---

## 📄 Licença

MIT © [Heleno Salgado](https://github.com/HelenoSalgado)

---

## 🔗 Links

- [GitHub](https://github.com/HelenoSalgado/routerworkers)
- [npm](https://www.npmjs.com/package/routerworkers)
- [Issues](https://github.com/HelenoSalgado/routerworkers/issues)

---

<div align="center">

**Feito com ❤️ para Cloudflare Workers**

Se este projeto foi útil, considere dar uma ⭐ no GitHub!

</div> 






