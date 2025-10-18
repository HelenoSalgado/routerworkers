# Proposta: Integração Opcional do Zod

## 🎯 Estratégia: Plugin Opcional

**Princípio**: Zod como **peer dependency opcional** que não afeta o bundle para quem não usa.

---

## 📦 Arquitetura Proposta

### 1. Estrutura de Arquivos

```
routerworkers/
├── src/
│   ├── index.ts                    # Core (sem Zod)
│   ├── plugins/
│   │   └── zod.ts                  # Plugin Zod (opcional)
│   └── utils/
│       └── validator.ts            # Validador built-in (sempre disponível)
│
└── package.json
    ├── dependencies: {}            # Vazio!
    └── peerDependencies: {
          "zod": "^3.0.0"           # Opcional
        }
```

### 2. Como Funciona

**Sem Zod** (padrão):
```typescript
import { RouterWorkers, validate } from 'routerworkers';

// Usa validador built-in (zero deps)
app.post('/users', validate({
    body: {
        name: { type: 'string', required: true },
        email: { type: 'email', required: true }
    }
}), handler);
```

**Com Zod** (opt-in):
```typescript
import { RouterWorkers } from 'routerworkers';
import { zodValidate } from 'routerworkers/plugins/zod'; // Importa plugin
import { z } from 'zod'; // Usuário instala Zod

const userSchema = z.object({
    name: z.string().min(3),
    email: z.string().email()
});

app.post('/users', zodValidate({ body: userSchema }), handler);
```

---

## 💻 Implementação

### 1. Plugin Zod (`src/plugins/zod.ts`)

```typescript
/**
 * Plugin Zod para RouterWorkers
 * Requer: npm install zod
 */

import type { Req, Res, Middleware } from '../types/index';
import type { z, ZodSchema, ZodError } from 'zod';

// Re-exporta tipos do Zod para conveniência
export type { z, ZodSchema, ZodError } from 'zod';

/**
 * Interface para configuração de validação Zod
 */
export interface ZodValidateConfig {
    body?: ZodSchema<any>;
    params?: ZodSchema<any>;
    queries?: ZodSchema<any>;
    /**
     * Handler customizado de erro de validação
     */
    onError?: (error: ZodError, req: Req, res: Res) => void;
}

/**
 * Cria middleware de validação usando Zod
 * 
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { zodValidate } from 'routerworkers/plugins/zod';
 * 
 * const userSchema = z.object({
 *   name: z.string().min(3),
 *   email: z.string().email()
 * });
 * 
 * app.post('/users', zodValidate({ body: userSchema }), handler);
 * ```
 */
export function zodValidate(config: ZodValidateConfig): Middleware {
    return async (req: Req, res: Res) => {
        // Lazy import do Zod (só carrega se usado)
        let zodModule: typeof import('zod');
        try {
            zodModule = await import('zod');
        } catch (error) {
            throw new Error(
                'Zod is required for zodValidate. Install it with: npm install zod'
            );
        }

        const { ZodError } = zodModule;

        try {
            // Valida body
            if (config.body && req.bodyJson) {
                req.bodyJson = config.body.parse(req.bodyJson);
            }

            // Valida params
            if (config.params && req.params) {
                req.params = config.params.parse(req.params);
            }

            // Valida queries
            if (config.queries && req.queries) {
                req.queries = config.queries.parse(req.queries);
            }
        } catch (error) {
            if (error instanceof ZodError) {
                // Handler customizado ou padrão
                if (config.onError) {
                    config.onError(error, req, res);
                } else {
                    // Handler padrão: retorna erros estruturados
                    res.send({
                        error: 'Validation failed',
                        issues: error.issues.map(issue => ({
                            path: issue.path.join('.'),
                            message: issue.message,
                            code: issue.code
                        }))
                    }, { status: 400 });
                }
            } else {
                throw error; // Re-throw se não for ZodError
            }
        }
    };
}

/**
 * Helper para criar schemas Zod reutilizáveis
 */
export const schemas = {
    /**
     * Schema para UUID
     */
    uuid: () => {
        // Lazy import
        return import('zod').then(({ z }) => 
            z.string().uuid('Invalid UUID format')
        );
    },

    /**
     * Schema para email
     */
    email: () => {
        return import('zod').then(({ z }) => 
            z.string().email('Invalid email format')
        );
    },

    /**
     * Schema para paginação
     */
    pagination: () => {
        return import('zod').then(({ z }) => 
            z.object({
                page: z.coerce.number().min(1).default(1),
                limit: z.coerce.number().min(1).max(100).default(10)
            })
        );
    }
};

/**
 * Utility: Infere tipo TypeScript de um schema Zod
 * 
 * @example
 * ```typescript
 * const userSchema = z.object({ name: z.string() });
 * type User = Infer<typeof userSchema>; // { name: string }
 * ```
 */
export type Infer<T extends ZodSchema<any>> = z.infer<T>;
```

### 2. Atualizar package.json

```json
{
  "name": "routerworkers",
  "version": "0.1.0-beta",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./plugins/zod": {
      "types": "./dist/plugins/zod.d.ts",
      "import": "./dist/plugins/zod.js"
    }
  },
  "peerDependencies": {
    "zod": "^3.0.0"
  },
  "peerDependenciesMeta": {
    "zod": {
      "optional": true
    }
  }
}
```

### 3. Atualizar tsconfig.json

```json
{
  "compilerOptions": {
    "paths": {
      "routerworkers": ["./src/index.ts"],
      "routerworkers/plugins/zod": ["./src/plugins/zod.ts"]
    }
  }
}
```

---

## 📚 Documentação de Uso

### Instalação

```bash
# RouterWorkers sozinho (sem Zod)
npm install routerworkers

# RouterWorkers + Zod (opcional)
npm install routerworkers zod
```

### Exemplo Completo com Zod

```typescript
import { RouterWorkers, Req, Res } from 'routerworkers';
import { zodValidate } from 'routerworkers/plugins/zod';
import { z } from 'zod';

// Definir schemas
const CreateUserSchema = z.object({
    name: z.string().min(3).max(50),
    email: z.string().email(),
    age: z.number().int().min(18).max(120),
    role: z.enum(['user', 'admin', 'moderator']).default('user'),
    preferences: z.object({
        newsletter: z.boolean().default(false),
        notifications: z.boolean().default(true)
    }).optional()
});

const UserIdSchema = z.object({
    id: z.string().uuid()
});

const PaginationSchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
    sort: z.enum(['asc', 'desc']).default('desc')
});

// Inferir tipos automaticamente
type CreateUserInput = z.infer<typeof CreateUserSchema>;
type UserId = z.infer<typeof UserIdSchema>;
type Pagination = z.infer<typeof PaginationSchema>;

export default {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        // Lista usuários (com validação de queries)
        await app.get('/api/users', 
            zodValidate({ queries: PaginationSchema }),
            (req: Req, res: Res) => {
                const { page, limit, sort } = req.queries as Pagination;
                res.send({ 
                    users: [], 
                    pagination: { page, limit, total: 0 },
                    sort 
                });
            }
        );

        // Criar usuário (com validação de body)
        await app.post('/api/users',
            zodValidate({ 
                body: CreateUserSchema,
                // Handler de erro customizado
                onError: (error, req, res) => {
                    res.send({
                        error: 'Validation failed',
                        details: error.issues
                    }, { status: 422 });
                }
            }),
            async (req: Req, res: Res) => {
                const userData = req.bodyJson as CreateUserInput;
                // userData é tipado automaticamente!
                
                const user = await createUser(userData);
                res.send({ user }, { status: 201 });
            }
        );

        // Buscar usuário (com validação de params)
        await app.get('/api/users/:id',
            zodValidate({ params: UserIdSchema }),
            async (req: Req, res: Res) => {
                const { id } = req.params as UserId;
                // id é garantido ser UUID válido
                
                const user = await findUser(id);
                if (!user) {
                    throw new Error('User not found');
                }
                res.send({ user });
            }
        );

        // Atualizar usuário (validação de params + body)
        await app.put('/api/users/:id',
            zodValidate({
                params: UserIdSchema,
                body: CreateUserSchema.partial() // Todos campos opcionais
            }),
            async (req: Req, res: Res) => {
                const { id } = req.params as UserId;
                const updates = req.bodyJson;
                
                const user = await updateUser(id, updates);
                res.send({ user });
            }
        );

        return app.resolve();
    }
};
```

### Exemplo com Schemas Reutilizáveis

```typescript
import { zodValidate, schemas } from 'routerworkers/plugins/zod';
import { z } from 'zod';

// Compor schemas
const BaseEntitySchema = z.object({
    id: await schemas.uuid(),
    createdAt: z.date(),
    updatedAt: z.date()
});

const UserSchema = BaseEntitySchema.extend({
    name: z.string(),
    email: await schemas.email()
});

const PostSchema = BaseEntitySchema.extend({
    title: z.string().min(5),
    content: z.string(),
    authorId: await schemas.uuid()
});
```

---

## ⚖️ Comparação: Built-in vs Zod

### Quando usar Built-in

✅ Projetos simples  
✅ Bundle size crítico  
✅ Validações básicas suficientes  
✅ Sem necessidade de transformações  
✅ Time pequeno sem experiência com Zod  

```typescript
import { validate } from 'routerworkers';

app.post('/users', validate({
    body: {
        name: { type: 'string', required: true, minLength: 3 },
        email: { type: 'email', required: true }
    }
}), handler);
```

### Quando usar Zod

✅ Projetos complexos  
✅ Muitas validações  
✅ Necessidade de transformações  
✅ Type safety máximo  
✅ Schemas reutilizáveis  
✅ Time experiente com Zod  

```typescript
import { zodValidate } from 'routerworkers/plugins/zod';
import { z } from 'zod';

const userSchema = z.object({
    name: z.string().min(3),
    email: z.string().email().toLowerCase(),
    age: z.string().transform(Number)
});

app.post('/users', zodValidate({ body: userSchema }), handler);
```

---

## 📊 Impacto no Bundle

### Sem Zod (padrão)
- RouterWorkers: ~12KB
- Total: **~12KB** ✅

### Com Zod (opt-in)
- RouterWorkers: ~12KB
- Plugin Zod: ~1KB
- Zod library: ~13KB
- Total: **~26KB** (ainda muito leve!)

---

## ✅ Vantagens desta Abordagem

1. **Zero Impacto** - Quem não usa Zod não paga nada
2. **Type Safety** - Inferência automática de tipos
3. **Flexibilidade** - Escolha a ferramenta certa para o projeto
4. **Progressivo** - Comece simples, adicione Zod depois
5. **Tree-shaking** - Bundlers removem plugin se não usado
6. **Manutenibilidade** - Zod se atualiza independente

---

## 🚀 Implementação Recomendada

### Fase 2A (Imediato)
1. ✅ Criar validador built-in (já proposto)
2. ✅ Documentar bem o validador built-in
3. ✅ Adicionar exemplos práticos

### Fase 2B (Próximo)
1. ⬜ Criar `src/plugins/zod.ts`
2. ⬜ Adicionar Zod como peer dependency opcional
3. ⬜ Documentar integração Zod
4. ⬜ Criar exemplos com Zod
5. ⬜ Testes para plugin Zod

---

## 💭 Conclusão

**Recomendação**: 
- ✅ Implementar **validador built-in** primeiro (Fase 2)
- ✅ Adicionar **plugin Zod opcional** depois (Fase 2B)
- ✅ Documentar **ambas abordagens** claramente
- ✅ Deixar usuário **escolher** o que prefere

Isso mantém RouterWorkers **simples e minimalista** por padrão, mas oferece **poder máximo** para quem precisa!
