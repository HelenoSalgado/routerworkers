# Padrões de Extensão do RouterWorkers

## 🎨 Como Estender o RouterWorkers

### Padrão 1: Plugin Pattern (Recomendado para Zod)

**Vantagens**:
- ✅ Não modifica o core
- ✅ Tree-shakeable
- ✅ Opt-in total
- ✅ Fácil manutenção

```typescript
// src/plugins/zod.ts
import type { Middleware } from '../types';

export function zodValidate(config: any): Middleware {
    return async (req, res) => {
        // Lazy load Zod
        const { z } = await import('zod');
        // Validação...
    };
}

// Uso
import { zodValidate } from 'routerworkers/plugins/zod';
app.post('/users', zodValidate({ ... }), handler);
```

---

### Padrão 2: Decorator/Wrapper Pattern

**Vantagens**:
- ✅ Adiciona funcionalidade sem modificar classe
- ✅ Composição sobre herança
- ✅ Reutilizável

```typescript
// src/extensions/withValidation.ts
import { RouterWorkers } from '../index';
import type { Req, Res, Middleware } from '../types';

export function withValidation(app: RouterWorkers) {
    return {
        ...app,
        
        /**
         * GET com validação automática
         */
        validatedGet(path: string, schema: any, ...middlewares: Middleware[]) {
            const validator: Middleware = async (req, res) => {
                // Validação aqui
            };
            
            return app.get(path, validator, ...middlewares);
        },
        
        /**
         * POST com validação automática
         */
        validatedPost(path: string, schema: any, ...middlewares: Middleware[]) {
            const validator: Middleware = async (req, res) => {
                // Validação aqui
            };
            
            return app.post(path, validator, ...middlewares);
        }
    };
}

// Uso
const app = withValidation(new RouterWorkers(request));
await app.validatedPost('/users', userSchema, handler);
```

---

### Padrão 3: Factory Pattern

**Vantagens**:
- ✅ Configuração centralizada
- ✅ Pré-configurações reutilizáveis
- ✅ DRY

```typescript
// src/factories/createApp.ts
import { RouterWorkers } from '../index';
import type { ConfigWorker } from '../types';

export interface AppConfig extends ConfigWorker {
    validation?: {
        provider: 'zod' | 'built-in';
        strict?: boolean;
    };
    errorHandling?: {
        logErrors?: boolean;
        showStack?: boolean;
    };
}

export function createApp(request: Request, config?: AppConfig) {
    const app = new RouterWorkers(request, config);
    
    // Configurar error handling
    if (config?.errorHandling) {
        app.onError((error, req, res) => {
            if (config.errorHandling?.logErrors) {
                console.error('[ERROR]', error);
            }
            
            const response: any = { error: error.message };
            
            if (config.errorHandling?.showStack && error.stack) {
                response.stack = error.stack;
            }
            
            res.send(response, { status: 500 });
        });
    }
    
    // Configurar validação
    if (config?.validation?.provider === 'zod') {
        // Configurar validação Zod
    }
    
    return app;
}

// Uso
const app = createApp(request, {
    cache: { pathname: ['/api/users'], maxage: '3600' },
    validation: { provider: 'zod', strict: true },
    errorHandling: { logErrors: true, showStack: false }
});
```

---

### Padrão 4: Mixin Pattern (Avançado)

**Vantagens**:
- ✅ Adiciona métodos à classe
- ✅ Type-safe
- ✅ Composição múltipla

```typescript
// src/mixins/ValidationMixin.ts
import type { RouterWorkers } from '../index';
import type { Middleware } from '../types';

export interface ValidationMixin {
    validate(schema: any): Middleware;
}

export function applyValidationMixin<T extends RouterWorkers>(
    Base: new (...args: any[]) => T
) {
    return class extends Base implements ValidationMixin {
        validate(schema: any): Middleware {
            return async (req, res) => {
                // Validação aqui
            };
        }
    };
}

// Uso
const EnhancedRouterWorkers = applyValidationMixin(RouterWorkers);
const app = new EnhancedRouterWorkers(request);
app.post('/users', app.validate(schema), handler);
```

---

## 🎯 Recomendação para Zod

### Implementação Proposta (Plugin Pattern)

```
routerworkers/
├── src/
│   ├── index.ts                    # Core do RouterWorkers
│   ├── plugins/                    # Pasta para plugins opcionais
│   │   ├── zod.ts                  # Plugin Zod
│   │   └── README.md               # Documentação de plugins
│   └── utils/
│       └── validator.ts            # Validador built-in
│
└── package.json
    └── peerDependencies: {
          "zod": "^3.0.0"           # Opcional!
        }
```

### Código do Plugin

```typescript
// src/plugins/zod.ts

/**
 * Plugin Zod para RouterWorkers
 * 
 * Instalação:
 *   npm install zod
 * 
 * Uso:
 *   import { zodValidate } from 'routerworkers/plugins/zod';
 *   import { z } from 'zod';
 * 
 *   const schema = z.object({ name: z.string() });
 *   app.post('/users', zodValidate({ body: schema }), handler);
 */

import type { Req, Res, Middleware } from '../types';

let zodImported: typeof import('zod') | null = null;

/**
 * Lazy load Zod (só carrega se usado)
 */
async function getZod() {
    if (!zodImported) {
        try {
            zodImported = await import('zod');
        } catch (error) {
            throw new Error(
                '❌ Zod not found! Install it with: npm install zod\n' +
                'Documentation: https://zod.dev'
            );
        }
    }
    return zodImported;
}

export interface ZodValidateOptions {
    body?: any;      // ZodSchema
    params?: any;    // ZodSchema
    queries?: any;   // ZodSchema
    onError?: (error: any, req: Req, res: Res) => void;
}

/**
 * Middleware de validação usando Zod
 */
export function zodValidate(options: ZodValidateOptions): Middleware {
    return async (req: Req, res: Res) => {
        const zod = await getZod();
        const { ZodError } = zod;

        try {
            // Validar e transformar body
            if (options.body && req.bodyJson) {
                req.bodyJson = options.body.parse(req.bodyJson);
            }

            // Validar e transformar params
            if (options.params && req.params) {
                req.params = options.params.parse(req.params);
            }

            // Validar e transformar queries
            if (options.queries && req.queries) {
                req.queries = options.queries.parse(req.queries);
            }
        } catch (error) {
            if (error instanceof ZodError) {
                // Handler customizado ou padrão
                if (options.onError) {
                    options.onError(error, req, res);
                } else {
                    // Resposta padrão estruturada
                    res.send({
                        error: 'Validation failed',
                        issues: error.issues.map(issue => ({
                            field: issue.path.join('.'),
                            message: issue.message,
                            code: issue.code
                        }))
                    }, { status: 400 });
                }
            } else {
                // Re-throw erros não-Zod
                throw error;
            }
        }
    };
}

/**
 * Re-export tipos Zod para conveniência
 */
export type { z, ZodSchema, ZodError, ZodIssue } from 'zod';
```

### Como Usuário Usa

```typescript
// worker.ts
import { RouterWorkers } from 'routerworkers';

// ✅ Opção 1: Sem Zod (validador built-in)
import { validate } from 'routerworkers';

app.post('/users', validate({
    body: {
        name: { type: 'string', required: true },
        email: { type: 'email', required: true }
    }
}), handler);

// ✅ Opção 2: Com Zod (opt-in)
import { zodValidate } from 'routerworkers/plugins/zod';
import { z } from 'zod';

const userSchema = z.object({
    name: z.string().min(3),
    email: z.string().email()
});

app.post('/users', zodValidate({ body: userSchema }), handler);
```

---

## 📦 Package.json

```json
{
  "name": "routerworkers",
  "version": "0.2.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  
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

---

## ✅ Benefícios desta Abordagem

### 1. Minimalismo Mantido
```
# Sem Zod
Bundle: 12KB ✅

# Com Zod
Bundle: 12KB + 13KB = 25KB
Mas apenas se o usuário importar o plugin!
```

### 2. Type Safety
```typescript
// Inferência automática de tipos
const schema = z.object({ name: z.string() });
type User = z.infer<typeof schema>; // { name: string }
```

### 3. Tree Shaking
```typescript
// Se não importar, bundler remove automaticamente
import { RouterWorkers } from 'routerworkers'; // 12KB
// plugins/zod.ts NÃO incluído no bundle ✅
```

### 4. Progressivo
```typescript
// Comece simples
import { validate } from 'routerworkers';

// Migre depois se precisar
import { zodValidate } from 'routerworkers/plugins/zod';
```

---

## 🎯 Conclusão

**Melhor abordagem para RouterWorkers + Zod**:

✅ **Plugin Pattern** com:
- Pasta `src/plugins/` para plugins opcionais
- Lazy loading do Zod
- Peer dependency opcional
- Exports separados no package.json
- Documentação clara de ambas opções

Isso mantém o RouterWorkers **simples por padrão**, mas **poderoso quando necessário**!
