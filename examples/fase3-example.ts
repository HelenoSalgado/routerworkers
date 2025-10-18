/**
 * Exemplos Fase 3 - Response Helpers, Route Groups e CORS
 * RouterWorkers v0.3.0
 */

import { RouterWorkers, cors, corsDevMode, corsProduction, group, validate, schemas } from '../src/index';
import type { Req, Res } from '../types/index';

// ============================================================================
// 1. RESPONSE HELPERS - USO BÁSICO
// ============================================================================

export const responseHelpersBasic = {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        // ✅ 200 OK
        await app.get('/success', (req: Req, res: Res) => {
            res.ok({ message: 'Success', data: [] });
        });

        // ✅ 201 Created (com Location header)
        await app.post('/users', (req: Req, res: Res) => {
            const userId = '123';
            res.created({ id: userId, name: 'John' }, `/users/${userId}`);
        });

        // ✅ 202 Accepted (processamento assíncrono)
        await app.post('/jobs', (req: Req, res: Res) => {
            res.accepted({ jobId: '456', status: 'processing' });
        });

        // ✅ 204 No Content
        await app.delete('/users/:id', (req: Req, res: Res) => {
            res.noContent();
        });

        return app.resolve();
    }
};

// ============================================================================
// 2. RESPONSE HELPERS - ERROS
// ============================================================================

export const responseHelpersErrors = {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        // ❌ 400 Bad Request
        await app.post('/users', (req: Req, res: Res) => {
            if (!req.bodyJson?.email) {
                return res.badRequest('Email is required');
            }
            res.created({ id: '123' });
        });

        // ❌ 401 Unauthorized
        await app.get('/profile', (req: Req, res: Res) => {
            const token = req.headers.get('Authorization');
            if (!token) {
                return res.unauthorized('Token required');
            }
            res.ok({ user: {} });
        });

        // ❌ 403 Forbidden
        await app.delete('/admin/users/:id', (req: Req, res: Res) => {
            const userRole = 'user'; // simulação
            if (userRole !== 'admin') {
                return res.forbidden('Admin access required');
            }
            res.noContent();
        });

        // ❌ 404 Not Found
        await app.get('/users/:id', (req: Req, res: Res) => {
            const user = null; // simulação
            if (!user) {
                return res.notFound('User not found');
            }
            res.ok({ user });
        });

        // ❌ 409 Conflict
        await app.post('/users', (req: Req, res: Res) => {
            const emailExists = true; // simulação
            if (emailExists) {
                return res.conflict({ 
                    error: 'Email already exists',
                    details: { field: 'email' }
                });
            }
            res.created({ id: '123' });
        });

        // ❌ 422 Unprocessable Entity
        await app.post('/users', (req: Req, res: Res) => {
            const errors = [
                { field: 'email', message: 'Invalid email' },
                { field: 'age', message: 'Must be at least 18' }
            ];
            res.unprocessable(errors);
        });

        // ❌ 500 Internal Server Error
        await app.get('/crash', (req: Req, res: Res) => {
            res.serverError('Something went wrong');
        });

        return app.resolve();
    }
};

// ============================================================================
// 3. RESPONSE HELPERS - FORMATOS DIFERENTES
// ============================================================================

export const responseFormats = {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        // JSON (padrão)
        await app.get('/api/data', (req: Req, res: Res) => {
            res.json({ items: [] }, 200);
        });

        // HTML
        await app.get('/page', (req: Req, res: Res) => {
            res.html(`
                <!DOCTYPE html>
                <html>
                    <head><title>Page</title></head>
                    <body><h1>Hello World</h1></body>
                </html>
            `);
        });

        // Text
        await app.get('/robots.txt', (req: Req, res: Res) => {
            res.text('User-agent: *\nDisallow: /admin/');
        });

        return app.resolve();
    }
};

// ============================================================================
// 4. ROUTE GROUPS - BÁSICO
// ============================================================================

export const routeGroupsBasic = {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        // Grupo de API
        await group(app, { prefix: '/api' }, async (api) => {
            
            // GET /api/users
            await api.get('/users', (req: Req, res: Res) => {
                res.ok({ users: [] });
            });

            // POST /api/users
            await api.post('/users', (req: Req, res: Res) => {
                res.created({ id: '123' });
            });

            // GET /api/users/:id
            await api.get('/users/:id', (req: Req, res: Res) => {
                const { id } = req.params!;
                res.ok({ user: { id } });
            });

            // PUT /api/users/:id
            await api.put('/users/:id', (req: Req, res: Res) => {
                res.ok({ updated: true });
            });

            // DELETE /api/users/:id
            await api.delete('/users/:id', (req: Req, res: Res) => {
                res.noContent();
            });
        });

        return app.resolve();
    }
};

// ============================================================================
// 5. ROUTE GROUPS - COM MIDDLEWARES
// ============================================================================

export const routeGroupsMiddlewares = {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        // Middleware de logging
        const logMiddleware = async (req: Req, res: Res) => {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
        };

        // Middleware de autenticação
        const authMiddleware = async (req: Req, res: Res) => {
            const token = req.headers.get('Authorization');
            if (!token) {
                res.unauthorized('Token required');
            }
        };

        // Grupo público (apenas logging)
        await group(app, { 
            prefix: '/public',
            middlewares: [logMiddleware]
        }, async (publicApi) => {
            
            await publicApi.get('/status', (req: Req, res: Res) => {
                res.ok({ status: 'online' });
            });
        });

        // Grupo privado (logging + autenticação)
        await group(app, {
            prefix: '/private',
            middlewares: [logMiddleware, authMiddleware]
        }, async (privateApi) => {
            
            await privateApi.get('/profile', (req: Req, res: Res) => {
                res.ok({ user: { name: 'John' } });
            });
        });

        return app.resolve();
    }
};

// ============================================================================
// 6. ROUTE GROUPS - ANINHADOS
// ============================================================================

export const routeGroupsNested = {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        const logMiddleware = async (req: Req, res: Res) => {
            console.log(`API: ${req.method} ${req.url}`);
        };

        const v1Middleware = async (req: Req, res: Res) => {
            console.log('API v1');
        };

        const authMiddleware = async (req: Req, res: Res) => {
            const token = req.headers.get('Authorization');
            if (!token) res.unauthorized();
        };

        // /api group
        await group(app, { 
            prefix: '/api',
            middlewares: [logMiddleware]
        }, async (api) => {
            
            // /api/v1 group
            await api.group({ 
                prefix: '/v1',
                middlewares: [v1Middleware]
            }, async (v1) => {
                
                // Rotas públicas: /api/v1/status
                await v1.get('/status', (req: Req, res: Res) => {
                    res.ok({ version: '1.0', status: 'online' });
                });

                // Subgrupo autenticado: /api/v1/users
                await v1.group({
                    prefix: '/users',
                    middlewares: [authMiddleware]
                }, async (users) => {
                    
                    // GET /api/v1/users
                    await users.get('/', (req: Req, res: Res) => {
                        res.ok({ users: [] });
                    });

                    // GET /api/v1/users/:id
                    await users.get('/:id', (req: Req, res: Res) => {
                        res.ok({ user: { id: req.params!.id } });
                    });
                });
            });

            // /api/v2 group
            await api.group({ prefix: '/v2' }, async (v2) => {
                await v2.get('/status', (req: Req, res: Res) => {
                    res.ok({ version: '2.0', status: 'online' });
                });
            });
        });

        return app.resolve();
    }
};

// ============================================================================
// 7. CORS - BÁSICO
// ============================================================================

export const corsBasic = {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        // CORS simples (permite tudo - desenvolvimento)
        await app.use(corsDevMode());

        await app.get('/api/data', (req: Req, res: Res) => {
            res.ok({ data: [] });
        });

        return app.resolve();
    }
};

// ============================================================================
// 8. CORS - PRODUÇÃO
// ============================================================================

export const corsProduction = {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        // CORS configurado para produção
        await app.use(corsProduction([
            'https://example.com',
            'https://app.example.com'
        ]));

        await app.get('/api/users', (req: Req, res: Res) => {
            res.ok({ users: [] });
        });

        return app.resolve();
    }
};

// ============================================================================
// 9. CORS - CUSTOMIZADO
// ============================================================================

export const corsCustom = {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        // CORS totalmente customizado
        await app.use(cors({
            origin: (origin) => {
                // Lógica customizada de validação
                return origin.endsWith('.example.com') || origin === 'https://trusted.com';
            },
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Custom-Header'],
            exposedHeaders: ['X-Total-Count'],
            credentials: true,
            maxAge: 3600
        }));

        await app.get('/api/data', (req: Req, res: Res) => {
            res.ok({ data: [] });
        });

        return app.resolve();
    }
};

// ============================================================================
// 10. API COMPLETA - TUDO JUNTO
// ============================================================================

export const completeAPIExample = {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        // Error handlers globais
        app.onError((error, req, res) => {
            console.error('[ERROR]', error);
            res.serverError(error.message);
        });

        app.notFound((req, res) => {
            res.notFound(`Route ${req.url} not found`);
        });

        // CORS
        await app.use(corsProduction(['https://app.example.com']));

        // Logging middleware
        await app.use(async (req, res) => {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
        });

        // API v1
        await group(app, { prefix: '/api/v1' }, async (api) => {
            
            // Public routes
            await api.get('/status', (req: Req, res: Res) => {
                res.ok({ status: 'online', version: '1.0' });
            });

            // Users CRUD
            await api.get('/users',
                validate({ queries: schemas.pagination }),
                (req: Req, res: Res) => {
                    const { page = 1, limit = 10 } = req.queries || {};
                    res.ok({ users: [], page, limit });
                }
            );

            await api.get('/users/:id',
                validate({ params: { id: schemas.uuid } }),
                (req: Req, res: Res) => {
                    res.ok({ user: { id: req.params!.id } });
                }
            );

            await api.post('/users',
                validate({
                    body: {
                        name: { type: 'string', required: true, minLength: 3 },
                        email: { type: 'email', required: true },
                        age: { type: 'number', min: 18 }
                    }
                }),
                (req: Req, res: Res) => {
                    const user = req.bodyJson;
                    res.created({ id: '123', ...user }, '/api/v1/users/123');
                }
            );

            await api.put('/users/:id',
                validate({ params: { id: schemas.uuid } }),
                (req: Req, res: Res) => {
                    res.ok({ updated: true });
                }
            );

            await api.delete('/users/:id',
                validate({ params: { id: schemas.uuid } }),
                (req: Req, res: Res) => {
                    res.noContent();
                }
            );
        });

        return app.resolve();
    }
};
