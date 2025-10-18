# Exemplos de Implementação - RouterWorkers

Este documento apresenta implementações práticas das melhorias propostas, com código funcional que pode ser integrado ao projeto.

---

## 1. Suporte a Rotas Aninhadas

### Implementação do Parser de Rotas

```typescript
// src/utils/routeParser.ts
export interface RouteMatch {
    matched: boolean;
    params: Record<string, string>;
}

export class RouteParser {
    private pattern: RegExp;
    private paramNames: string[];

    constructor(route: string) {
        this.paramNames = [];
        
        // Converte rota em regex
        // /api/users/:userId/posts/:postId -> /^\/api\/users\/([^\/]+)\/posts\/([^\/]+)$/
        const regexPattern = route
            .replace(/\//g, '\\/') // Escapa barras
            .replace(/:(\w+)/g, (_, paramName) => {
                this.paramNames.push(paramName);
                return '([^\\/]+)'; // Captura qualquer coisa exceto /
            });
        
        this.pattern = new RegExp(`^${regexPattern}$`);
    }

    match(pathname: string): RouteMatch {
        const matches = pathname.match(this.pattern);
        
        if (!matches) {
            return { matched: false, params: {} };
        }

        const params: Record<string, string> = {};
        this.paramNames.forEach((name, index) => {
            params[name] = decodeURIComponent(matches[index + 1]);
        });

        return { matched: true, params };
    }
}
```

### Integração no RouterWorkers

```typescript
// Modificação no método isPathName()
private routeParsers: Map<string, RouteParser> = new Map();

private getOrCreateParser(route: string): RouteParser {
    if (!this.routeParsers.has(route)) {
        this.routeParsers.set(route, new RouteParser(route));
    }
    return this.routeParsers.get(route)!;
}

isPathName(path: string): boolean {
    const parser = this.getOrCreateParser(path);
    const match = parser.match(this.url.pathname);
    
    if (match.matched) {
        this.req['params'] = match.params; // Plural para consistência
        return true;
    }
    
    return false;
}
```

### Exemplo de Uso

```typescript
// Rotas simples
app.get('/users/:id', (req, res) => {
    // req.params = { id: '123' }
});

// Rotas aninhadas
app.get('/api/v1/users/:userId/posts/:postId', (req, res) => {
    const { userId, postId } = req.params;
    // userId = '123', postId = '456'
});

// Múltiplos níveis
app.get('/categories/:category/products/:productId/reviews/:reviewId', (req, res) => {
    // req.params = { category: 'electronics', productId: '789', reviewId: '101' }
});
```

---

## 2. Sistema de Tratamento de Erros

### Implementação

```typescript
// types/index.ts - Adicionar novos tipos
export type ErrorHandler = (error: Error, req: Req, res: Res) => void | Promise<void>;
export type NotFoundHandler = (req: Req, res: Res) => void | Promise<void>;

export class HttpError extends Error {
    constructor(
        public statusCode: number,
        message: string,
        public details?: any
    ) {
        super(message);
        this.name = 'HttpError';
    }
}

// src/index.ts - Adicionar ao RouterWorkers
export class RouterWorkers {
    private errorHandler?: ErrorHandler;
    private notFoundHandler?: NotFoundHandler;
    
    // ... código existente ...

    // Registrar handler de erro global
    onError(handler: ErrorHandler): void {
        this.errorHandler = handler;
    }

    // Registrar handler de 404
    notFound(handler: NotFoundHandler): void {
        this.notFoundHandler = handler;
    }

    // Wrapper para executar handlers com try-catch
    private async executeHandler(handler: Function): Promise<void> {
        try {
            await handler(this.req, this.res);
        } catch (error) {
            await this.handleError(error);
        }
    }

    // Processar erros
    private async handleError(error: any): Promise<void> {
        if (this.errorHandler) {
            await this.errorHandler(error, this.req, this.res);
        } else {
            // Handler padrão
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Internal Server Error';
            
            this.res.send(
                { error: message, ...(error.details && { details: error.details }) },
                { status: statusCode }
            );
        }
    }

    // Modificar método resolve()
    resolve(): Response {
        if (!this.response) {
            if (this.notFoundHandler) {
                this.notFoundHandler(this.req, this.res);
            } else {
                this.res.send(
                    { error: 'Not Found', path: this.url.pathname },
                    { status: 404 }
                );
            }
        }
        return this.response as Response;
    }
}
```

### Exemplo de Uso

```typescript
// Handler global de erros
app.onError((error, req, res) => {
    console.error(`[ERROR] ${req.method} ${req.url}:`, error);
    
    if (error instanceof HttpError) {
        res.send({ error: error.message }, { status: error.statusCode });
    } else {
        res.send({ error: 'Internal Server Error' }, { status: 500 });
    }
});

// Handler customizado de 404
app.notFound((req, res) => {
    res.send({
        error: 'Route not found',
        path: req.url,
        suggestion: 'Check the API documentation'
    }, { status: 404 });
});

// Usar HttpError nas rotas
app.get('/users/:id', async (req, res) => {
    const user = await findUser(req.params.id);
    
    if (!user) {
        throw new HttpError(404, 'User not found', { userId: req.params.id });
    }
    
    res.send(user);
});
```

---

## 3. Suporte a CORS

### Implementação

```typescript
// types/index.ts
export interface CORSConfig {
    origin?: string | string[] | ((origin: string) => boolean);
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
}

// src/middlewares/cors.ts
export function createCORSMiddleware(config: CORSConfig = {}) {
    const {
        origin = '*',
        methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders = ['Content-Type', 'Authorization'],
        exposedHeaders = [],
        credentials = false,
        maxAge = 86400
    } = config;

    return async (req: Req, res: Res) => {
        const requestOrigin = req.headers.get('Origin') || '';
        let allowedOrigin = '*';

        // Determinar origem permitida
        if (typeof origin === 'string') {
            allowedOrigin = origin;
        } else if (Array.isArray(origin)) {
            allowedOrigin = origin.includes(requestOrigin) ? requestOrigin : origin[0];
        } else if (typeof origin === 'function') {
            allowedOrigin = origin(requestOrigin) ? requestOrigin : '';
        }

        // Headers CORS
        const corsHeaders: Record<string, string> = {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': methods.join(', '),
            'Access-Control-Allow-Headers': allowedHeaders.join(', ')
        };

        if (exposedHeaders.length > 0) {
            corsHeaders['Access-Control-Expose-Headers'] = exposedHeaders.join(', ');
        }

        if (credentials) {
            corsHeaders['Access-Control-Allow-Credentials'] = 'true';
        }

        if (maxAge) {
            corsHeaders['Access-Control-Max-Age'] = maxAge.toString();
        }

        // Interceptar res.send para adicionar headers
        const originalSend = res.send;
        res.send = (data: any, config?: ResponseInit) => {
            const headers = new Headers(config?.headers || {});
            Object.entries(corsHeaders).forEach(([key, value]) => {
                headers.set(key, value);
            });
            
            return originalSend(data, { ...config, headers });
        };

        // Responder a preflight (OPTIONS)
        if (req.method === 'OPTIONS') {
            res.send('', { status: 204, headers: corsHeaders });
        }
    };
}
```

### Exemplo de Uso

```typescript
// CORS global
app.use(createCORSMiddleware({
    origin: ['https://app.example.com', 'https://admin.example.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

// CORS específico para uma rota
app.get('/public-api', 
    createCORSMiddleware({ origin: '*' }),
    (req, res) => {
        res.send({ data: 'public data' });
    }
);

// Origem dinâmica
app.use(createCORSMiddleware({
    origin: (requestOrigin) => {
        // Permitir subdomínios de example.com
        return /\.example\.com$/.test(requestOrigin);
    }
}));
```

---

## 4. Response Helpers

### Implementação

```typescript
// Estender interface Res em types/index.ts
export interface Res {
    send: (data: any, config?: ResponseInit) => void;
    redirect: (url: string | URL, status?: number) => void;
    
    // Status helpers
    ok: (data: any) => void;
    created: (data: any) => void;
    noContent: () => void;
    badRequest: (message: string) => void;
    unauthorized: (message?: string) => void;
    forbidden: (message?: string) => void;
    notFound: (message?: string) => void;
    serverError: (message?: string) => void;
    
    // Content-type helpers
    json: (data: any, status?: number) => void;
    html: (html: string, status?: number) => void;
    text: (text: string, status?: number) => void;
    
    // Header helpers
    header: (name: string, value: string) => Res;
    headers: (headers: Record<string, string>) => Res;
}

// src/index.ts - Modificar construtor do RouterWorkers
export class RouterWorkers {
    private customHeaders: Record<string, string> = {};

    constructor(request: Request, config?: ConfigWorker) {
        // ... código existente ...
        
        // Criar objeto res com todos os helpers
        this.res = this.createResObject();
    }

    private createResObject(): Res {
        const customHeaders = this.customHeaders;
        const self = this;

        return {
            send: (data: any, config?: ResponseInit) => {
                const headers = new Headers(config?.headers || {});
                Object.entries(customHeaders).forEach(([key, value]) => {
                    headers.set(key, value);
                });

                if (typeof data === 'object') {
                    self.response = Response.json(data, { ...config, headers });
                } else {
                    self.response = new Response(data, { ...config, headers });
                }
                self.resolved = true;
            },

            redirect: (url: string | URL, status?: number) => {
                self.response = Response.redirect(url, status);
                self.resolved = true;
            },

            // Status helpers
            ok: (data: any) => {
                this.json(data, 200);
            },

            created: (data: any) => {
                this.json(data, 201);
            },

            noContent: () => {
                this.send('', { status: 204 });
            },

            badRequest: (message: string) => {
                this.json({ error: message }, 400);
            },

            unauthorized: (message = 'Unauthorized') => {
                this.json({ error: message }, 401);
            },

            forbidden: (message = 'Forbidden') => {
                this.json({ error: message }, 403);
            },

            notFound: (message = 'Not Found') => {
                this.json({ error: message }, 404);
            },

            serverError: (message = 'Internal Server Error') => {
                this.json({ error: message }, 500);
            },

            // Content-type helpers
            json: (data: any, status = 200) => {
                this.send(data, { 
                    status,
                    headers: { 'Content-Type': 'application/json' }
                });
            },

            html: (html: string, status = 200) => {
                this.send(html, { 
                    status,
                    headers: { 'Content-Type': 'text/html; charset=utf-8' }
                });
            },

            text: (text: string, status = 200) => {
                this.send(text, { 
                    status,
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            },

            // Header helpers
            header: (name: string, value: string) => {
                customHeaders[name] = value;
                return this;
            },

            headers: (headers: Record<string, string>) => {
                Object.assign(customHeaders, headers);
                return this;
            }
        };
    }
}
```

### Exemplo de Uso

```typescript
// Status helpers
app.get('/users', async (req, res) => {
    const users = await getUsers();
    res.ok(users); // 200 OK
});

app.post('/users', async (req, res) => {
    const user = await createUser(req.bodyJson);
    res.created(user); // 201 Created
});

app.delete('/users/:id', async (req, res) => {
    await deleteUser(req.params.id);
    res.noContent(); // 204 No Content
});

// Error helpers
app.get('/users/:id', async (req, res) => {
    const user = await findUser(req.params.id);
    if (!user) {
        return res.notFound('User not found');
    }
    res.ok(user);
});

// Content-type helpers
app.get('/page', (req, res) => {
    res.html('<h1>Hello World</h1>');
});

app.get('/robots.txt', (req, res) => {
    res.text('User-agent: *\nDisallow: /admin');
});

// Headers encadeados
app.get('/api/data', (req, res) => {
    res
        .header('X-Custom-Header', 'value')
        .header('X-Rate-Limit', '100')
        .json({ data: 'example' });
});
```

---

## 5. Route Groups (Agrupamento de Rotas)

### Implementação

```typescript
// types/index.ts
export interface RouteGroup {
    get: (...args: Args) => Promise<void>;
    post: (...args: Args) => Promise<void>;
    put: (...args: Args) => Promise<void>;
    delete: (...args: Args) => Promise<void>;
    use: (...middlewares: Function[]) => void;
}

// src/index.ts
export class RouterWorkers {
    // ... código existente ...

    group(prefix: string, ...groupMiddlewares: Function[]): RouteGroup {
        const self = this;

        return {
            async get(...args: Args) {
                const [path, ...rest] = args;
                const fullPath = prefix + path;
                await self.get(fullPath, ...groupMiddlewares, ...rest);
            },

            async post(...args: Args) {
                const [path, ...rest] = args;
                const fullPath = prefix + path;
                await self.post(fullPath, ...groupMiddlewares, ...rest);
            },

            async put(...args: Args) {
                const [path, ...rest] = args;
                const fullPath = prefix + path;
                await self.put(fullPath, ...groupMiddlewares, ...rest);
            },

            async delete(...args: Args) {
                const [path, ...rest] = args;
                const fullPath = prefix + path;
                await self.delete(fullPath, ...groupMiddlewares, ...rest);
            },

            use(...middlewares: Function[]) {
                groupMiddlewares.push(...middlewares);
            }
        };
    }
}
```

### Exemplo de Uso

```typescript
// API v1
const v1 = app.group('/api/v1');
v1.get('/users', getUsers);
v1.get('/posts', getPosts);
// Rotas: /api/v1/users, /api/v1/posts

// Admin com autenticação
const admin = app.group('/admin', authMiddleware);
admin.get('/dashboard', getDashboard);
admin.post('/settings', updateSettings);
// Todas as rotas /admin/* passam por authMiddleware

// Nested groups
const apiV2 = app.group('/api/v2', rateLimitMiddleware);
const apiV2Users = app.group('/api/v2/users', authMiddleware);
apiV2Users.get('/', listUsers);
apiV2Users.get('/:id', getUser);
// Rotas: /api/v2/users e /api/v2/users/:id com ambos middlewares
```

---

## 6. Validação de Dados (Simples, sem dependências)

### Implementação

```typescript
// src/utils/validator.ts
export interface ValidationRule {
    type?: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'uuid' | 'array' | 'object';
    required?: boolean;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    enum?: any[];
    custom?: (value: any) => boolean | string;
}

export interface ValidationSchema {
    [key: string]: ValidationRule;
}

export class ValidationError extends Error {
    constructor(
        public field: string,
        message: string
    ) {
        super(`Validation error on field '${field}': ${message}`);
        this.name = 'ValidationError';
    }
}

export function validate(value: any, rule: ValidationRule, fieldName: string): void {
    // Required check
    if (rule.required && (value === undefined || value === null || value === '')) {
        throw new ValidationError(fieldName, 'is required');
    }

    if (value === undefined || value === null) return;

    // Type check
    if (rule.type) {
        switch (rule.type) {
            case 'string':
                if (typeof value !== 'string') {
                    throw new ValidationError(fieldName, 'must be a string');
                }
                break;
            case 'number':
                if (typeof value !== 'number' || isNaN(value)) {
                    throw new ValidationError(fieldName, 'must be a number');
                }
                break;
            case 'boolean':
                if (typeof value !== 'boolean') {
                    throw new ValidationError(fieldName, 'must be a boolean');
                }
                break;
            case 'email':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    throw new ValidationError(fieldName, 'must be a valid email');
                }
                break;
            case 'url':
                try {
                    new URL(value);
                } catch {
                    throw new ValidationError(fieldName, 'must be a valid URL');
                }
                break;
            case 'uuid':
                if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
                    throw new ValidationError(fieldName, 'must be a valid UUID');
                }
                break;
            case 'array':
                if (!Array.isArray(value)) {
                    throw new ValidationError(fieldName, 'must be an array');
                }
                break;
            case 'object':
                if (typeof value !== 'object' || Array.isArray(value)) {
                    throw new ValidationError(fieldName, 'must be an object');
                }
                break;
        }
    }

    // Min/Max for numbers
    if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
            throw new ValidationError(fieldName, `must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
            throw new ValidationError(fieldName, `must be at most ${rule.max}`);
        }
    }

    // MinLength/MaxLength for strings and arrays
    if (typeof value === 'string' || Array.isArray(value)) {
        if (rule.minLength !== undefined && value.length < rule.minLength) {
            throw new ValidationError(fieldName, `must have at least ${rule.minLength} characters`);
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
            throw new ValidationError(fieldName, `must have at most ${rule.maxLength} characters`);
        }
    }

    // Pattern for strings
    if (typeof value === 'string' && rule.pattern) {
        if (!rule.pattern.test(value)) {
            throw new ValidationError(fieldName, `does not match pattern ${rule.pattern}`);
        }
    }

    // Enum check
    if (rule.enum && !rule.enum.includes(value)) {
        throw new ValidationError(fieldName, `must be one of: ${rule.enum.join(', ')}`);
    }

    // Custom validator
    if (rule.custom) {
        const result = rule.custom(value);
        if (result !== true) {
            throw new ValidationError(fieldName, typeof result === 'string' ? result : 'failed custom validation');
        }
    }
}

export function validateObject(data: any, schema: ValidationSchema): void {
    for (const [field, rule] of Object.entries(schema)) {
        validate(data[field], rule, field);
    }
}

// Middleware factory
export function createValidationMiddleware(schemas: {
    body?: ValidationSchema;
    params?: ValidationSchema;
    queries?: ValidationSchema;
}) {
    return async (req: Req, res: Res) => {
        try {
            if (schemas.body && req.bodyJson) {
                validateObject(req.bodyJson, schemas.body);
            }
            if (schemas.params && req.params) {
                validateObject(req.params, schemas.params);
            }
            if (schemas.queries && req.queries) {
                validateObject(req.queries, schemas.queries);
            }
        } catch (error) {
            if (error instanceof ValidationError) {
                res.send({ error: error.message }, { status: 400 });
            } else {
                throw error;
            }
        }
    };
}
```

### Exemplo de Uso

```typescript
// Validar body
app.post('/users', 
    createValidationMiddleware({
        body: {
            name: { type: 'string', required: true, minLength: 3, maxLength: 50 },
            email: { type: 'email', required: true },
            age: { type: 'number', min: 18, max: 120 },
            role: { type: 'string', enum: ['user', 'admin', 'moderator'] }
        }
    }),
    async (req, res) => {
        const user = await createUser(req.bodyJson);
        res.created(user);
    }
);

// Validar params
app.get('/users/:id', 
    createValidationMiddleware({
        params: {
            id: { type: 'uuid', required: true }
        }
    }),
    async (req, res) => {
        const user = await findUser(req.params.id);
        res.ok(user);
    }
);

// Validar queries
app.get('/posts', 
    createValidationMiddleware({
        queries: {
            page: { type: 'number', min: 1 },
            limit: { type: 'number', min: 1, max: 100 },
            status: { type: 'string', enum: ['draft', 'published', 'archived'] }
        }
    }),
    async (req, res) => {
        const posts = await getPosts(req.queries);
        res.ok(posts);
    }
);

// Validador customizado
app.post('/passwords', 
    createValidationMiddleware({
        body: {
            password: {
                type: 'string',
                required: true,
                minLength: 8,
                custom: (value) => {
                    if (!/[A-Z]/.test(value)) return 'must contain uppercase letter';
                    if (!/[a-z]/.test(value)) return 'must contain lowercase letter';
                    if (!/[0-9]/.test(value)) return 'must contain number';
                    return true;
                }
            }
        }
    }),
    async (req, res) => {
        await updatePassword(req.bodyJson.password);
        res.ok({ message: 'Password updated' });
    }
);
```

---

## Testes Unitários para as Novas Features

```typescript
// test/improvements.test.ts
import { RouterWorkers } from '../src/index';
import { RouteParser } from '../src/utils/routeParser';
import { validateObject, ValidationError } from '../src/utils/validator';

describe('Route Parser', () => {
    test('should match simple route', () => {
        const parser = new RouteParser('/users/:id');
        const result = parser.match('/users/123');
        
        expect(result.matched).toBe(true);
        expect(result.params).toEqual({ id: '123' });
    });

    test('should match nested routes', () => {
        const parser = new RouteParser('/api/users/:userId/posts/:postId');
        const result = parser.match('/api/users/123/posts/456');
        
        expect(result.matched).toBe(true);
        expect(result.params).toEqual({ userId: '123', postId: '456' });
    });

    test('should not match different routes', () => {
        const parser = new RouteParser('/users/:id');
        const result = parser.match('/posts/123');
        
        expect(result.matched).toBe(false);
    });
});

describe('Validator', () => {
    test('should validate required fields', () => {
        expect(() => {
            validateObject({}, { name: { required: true } });
        }).toThrow(ValidationError);
    });

    test('should validate email format', () => {
        expect(() => {
            validateObject({ email: 'invalid' }, { email: { type: 'email' } });
        }).toThrow(ValidationError);
        
        expect(() => {
            validateObject({ email: 'valid@example.com' }, { email: { type: 'email' } });
        }).not.toThrow();
    });

    test('should validate min/max numbers', () => {
        expect(() => {
            validateObject({ age: 15 }, { age: { type: 'number', min: 18 } });
        }).toThrow(ValidationError);
        
        expect(() => {
            validateObject({ age: 25 }, { age: { type: 'number', min: 18, max: 100 } });
        }).not.toThrow();
    });
});
```

---

## Conclusão

Estas implementações são **prontas para uso** e mantêm a filosofia minimalista do RouterWorkers:

✅ **Zero dependências** (exceto as já existentes)  
✅ **TypeScript nativo**  
✅ **Performance otimizada**  
✅ **API simples e intuitiva**  
✅ **Backward compatible**  

Cada feature pode ser implementada de forma incremental, permitindo testes e feedback da comunidade antes de avançar para a próxima.
