# RouterWorkers

<div align="center">

[![npm version](https://img.shields.io/npm/v/routerworkers.svg)](https://www.npmjs.com/package/routerworkers)
[![npm downloads](https://img.shields.io/npm/dm/routerworkers.svg)](https://www.npmjs.com/package/routerworkers)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)

**Um roteador moderno, minimalista e poderoso para Cloudflare Workers**

[Instalação](#-instalação) • [Início Rápido](#-início-rápido) • [Documentação](#-documentação) • [Exemplos](#-exemplos)

</div>

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

### API RESTful Completa

```typescript
import { RouterWorkers, group, cors, validate, schemas } from 'routerworkers';

export default {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        // CORS
        await app.use(cors({ origin: 'https://app.example.com' }));

        // Error handlers
        app.onError((error, req, res) => {
            console.error(error);
            res.serverError(error.message);
        });

        app.notFound((req, res) => {
            res.notFound('Route not found');
        });

        // API v1
        await group(app, { prefix: '/api/v1' }, async (api) => {
            
            // GET /api/v1/users
            await api.get('/users',
                validate({ queries: schemas.pagination }),
                (req, res) => {
                    res.ok({ users: [] });
                }
            );

            // GET /api/v1/users/:id
            await api.get('/users/:id',
                validate({ params: { id: schemas.uuid } }),
                (req, res) => {
                    res.ok({ user: { id: req.params!.id } });
                }
            );

            // POST /api/v1/users
            await api.post('/users',
                validate({
                    body: {
                        name: { type: 'string', required: true },
                        email: { type: 'email', required: true }
                    }
                }),
                (req, res) => {
                    res.created(req.bodyJson, `/api/v1/users/${req.bodyJson.id}`);
                }
            );

            // DELETE /api/v1/users/:id
            await api.delete('/users/:id', (req, res) => {
                res.noContent();
            });
        });

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
schemas.pagination   // { page?: number, limit?: number }
schemas.date         // Date válida
schemas.objectId     // MongoDB ObjectId
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

### Cache

```typescript
const app = new RouterWorkers(request, {
    cache: {
        pathname: ['/users', '/posts/:id'],
        maxage: '86400' // 24 horas
    }
});
```

---

## 📝 Exemplos

Veja a pasta [`examples/`](./examples) para exemplos completos:

- [Fase 1 - Rotas Aninhadas](./examples/fase1-example.ts)
- [Fase 2A - Validação](./examples/fase2a-example.ts)
- [Fase 3 - Response Helpers + Groups + CORS](./examples/fase3-example.ts)

---

## 🎯 Comparação com Outros Frameworks

| Feature | RouterWorkers | Express | Hono |
|---------|--------------|---------|------|
| Bundle Size | ~29KB | ~200KB | ~20KB |
| Response Helpers | ✅ 14 | ✅ ~10 | ✅ ~12 |
| Route Groups | ✅ | ✅ | ✅ |
| CORS Built-in | ✅ | ❌ | ✅ |
| Validação Built-in | ✅ | ❌ | ❌ |
| TypeScript | ✅ | ⚠️ | ✅ |
| Workers Native | ✅ | ❌ | ✅ |
| Zero Deps | ✅ | ❌ | ✅ |

---

## 🛠️ Tecnologias

- TypeScript 5.9+
- Cloudflare Workers
- Rollup (build)
- Jest (testes)

---

## 📊 Status

- ✅ **51 testes** passando (100%)
- ✅ **Zero dependências**
- ✅ **Bundle: ~29KB**
- ✅ **TypeScript strict mode**
- ✅ **Pronto para produção**

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

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






