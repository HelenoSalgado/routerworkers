/**
 * Exemplos de uso do Validador Built-in
 * RouterWorkers Fase 2A
 */

import { RouterWorkers, validate, schemas } from '../src/index';
import type { Req, Res } from '../types/index';

// ============================================================================
// 1. VALIDAÇÃO BÁSICA DE BODY
// ============================================================================

export const basicValidation = {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        // Validação simples
        await app.post('/users', 
            validate({
                body: {
                    name: { type: 'string', required: true, minLength: 3 },
                    email: { type: 'email', required: true },
                    age: { type: 'number', min: 18, max: 120 }
                }
            }),
            (req: Req, res: Res) => {
                const { name, email, age } = req.bodyJson;
                res.send({ created: true, user: { name, email, age } });
            }
        );

        return app.resolve();
    }
};

// ============================================================================
// 2. VALIDAÇÃO COM ENUM E PATTERN
// ============================================================================

export const advancedValidation = {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        await app.post('/users', 
            validate({
                body: {
                    username: { 
                        type: 'string', 
                        required: true,
                        pattern: /^[a-z0-9_]+$/,
                        minLength: 3,
                        maxLength: 20,
                        message: 'Username deve conter apenas letras minúsculas, números e underscore'
                    },
                    email: { type: 'email', required: true },
                    role: { 
                        type: 'string', 
                        enum: ['user', 'admin', 'moderator'],
                        message: 'Role deve ser user, admin ou moderator'
                    },
                    active: { type: 'boolean' }
                }
            }),
            (req: Req, res: Res) => {
                res.send({ created: true, user: req.bodyJson });
            }
        );

        return app.resolve();
    }
};

// ============================================================================
// 3. VALIDAÇÃO CUSTOMIZADA
// ============================================================================

export const customValidation = {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        await app.post('/users', 
            validate({
                body: {
                    password: {
                        type: 'string',
                        required: true,
                        custom: (value: string) => {
                            if (value.length < 8) {
                                return 'Senha deve ter pelo menos 8 caracteres';
                            }
                            if (!/[A-Z]/.test(value)) {
                                return 'Senha deve conter pelo menos uma letra maiúscula';
                            }
                            if (!/[a-z]/.test(value)) {
                                return 'Senha deve conter pelo menos uma letra minúscula';
                            }
                            if (!/[0-9]/.test(value)) {
                                return 'Senha deve conter pelo menos um número';
                            }
                            if (!/[!@#$%^&*]/.test(value)) {
                                return 'Senha deve conter pelo menos um caractere especial';
                            }
                            return true;
                        }
                    },
                    confirmPassword: {
                        type: 'string',
                        required: true
                    }
                }
            }),
            (req: Req, res: Res) => {
                const { password, confirmPassword } = req.bodyJson;
                
                // Validação adicional no handler
                if (password !== confirmPassword) {
                    return res.send({ 
                        error: 'As senhas não conferem' 
                    }, { status: 400 });
                }
                
                res.send({ created: true });
            }
        );

        return app.resolve();
    }
};

// ============================================================================
// 4. VALIDAÇÃO DE PARAMS (UUID)
// ============================================================================

export const paramsValidation = {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        await app.get('/users/:id', 
            validate({
                params: {
                    id: { type: 'uuid', required: true }
                }
            }),
            (req: Req, res: Res) => {
                // Se chegou aqui, id é um UUID válido
                const { id } = req.params!;
                res.send({ user: { id, name: 'John' } });
            }
        );

        // Usando schema pré-definido
        await app.get('/posts/:id', 
            validate({
                params: {
                    id: schemas.uuid
                }
            }),
            (req: Req, res: Res) => {
                res.send({ post: { id: req.params!.id } });
            }
        );

        return app.resolve();
    }
};

// ============================================================================
// 5. VALIDAÇÃO DE QUERIES (PAGINAÇÃO)
// ============================================================================

export const queriesValidation = {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        // URL: /users?page=1&limit=10&sort=asc&active=true
        await app.get('/users', 
            validate({
                queries: {
                    page: { type: 'number', min: 1 },
                    limit: { type: 'number', min: 1, max: 100 },
                    sort: { type: 'string', enum: ['asc', 'desc'] },
                    active: { type: 'boolean' }
                }
            }),
            (req: Req, res: Res) => {
                const { page = 1, limit = 10, sort = 'desc', active } = req.queries || {};
                
                res.send({ 
                    users: [],
                    pagination: { page, limit },
                    filters: { sort, active }
                });
            }
        );

        // Usando schema pré-definido de paginação
        await app.get('/posts', 
            validate({
                queries: schemas.pagination
            }),
            (req: Req, res: Res) => {
                const { page, limit } = req.queries || {};
                res.send({ posts: [], page, limit });
            }
        );

        return app.resolve();
    }
};

// ============================================================================
// 6. VALIDAÇÃO MÚLTIPLA (PARAMS + BODY)
// ============================================================================

export const multipleValidation = {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        await app.put('/users/:id', 
            validate({
                params: {
                    id: { type: 'uuid', required: true }
                },
                body: {
                    name: { type: 'string', minLength: 3 },
                    email: { type: 'email' },
                    age: { type: 'number', min: 18 }
                }
            }),
            (req: Req, res: Res) => {
                const { id } = req.params!;
                const updates = req.bodyJson;
                
                res.send({ 
                    updated: true,
                    user: { id, ...updates }
                });
            }
        );

        return app.resolve();
    }
};

// ============================================================================
// 7. HANDLER DE ERRO CUSTOMIZADO
// ============================================================================

export const customErrorHandler = {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        await app.post('/users', 
            validate({
                body: {
                    name: { type: 'string', required: true },
                    email: { type: 'email', required: true }
                },
                onError: (errors, req, res) => {
                    // Handler customizado de erro
                    console.error('[VALIDATION ERROR]', errors);
                    
                    res.send({
                        error: 'Dados inválidos',
                        detalhes: errors.map(err => ({
                            campo: err.field,
                            mensagem: err.message
                        })),
                        timestamp: new Date().toISOString()
                    }, { status: 422 }); // Unprocessable Entity
                }
            }),
            (req: Req, res: Res) => {
                res.send({ created: true });
            }
        );

        return app.resolve();
    }
};

// ============================================================================
// 8. API COMPLETA COM VALIDAÇÃO
// ============================================================================

export const completeAPI = {
    async fetch(request: Request): Promise<Response> {
        const app = new RouterWorkers(request);

        // Error handlers globais
        app.onError((error, req, res) => {
            console.error('[ERROR]', error);
            res.send({ error: error.message }, { status: 500 });
        });

        app.notFound((req, res) => {
            res.send({ error: 'Rota não encontrada' }, { status: 404 });
        });

        // Lista usuários com paginação validada
        await app.get('/api/users', 
            validate({
                queries: {
                    page: { type: 'number', min: 1 },
                    limit: { type: 'number', min: 1, max: 100 },
                    search: { type: 'string', maxLength: 100 },
                    role: { type: 'string', enum: ['user', 'admin', 'moderator'] }
                }
            }),
            (req: Req, res: Res) => {
                const { page = 1, limit = 10, search, role } = req.queries || {};
                
                res.send({ 
                    users: [],
                    pagination: { page, limit, total: 0 },
                    filters: { search, role }
                });
            }
        );

        // Buscar usuário por ID (UUID validado)
        await app.get('/api/users/:id', 
            validate({
                params: { id: schemas.uuid }
            }),
            (req: Req, res: Res) => {
                const { id } = req.params!;
                res.send({ 
                    user: { id, name: 'John Doe', email: 'john@example.com' }
                });
            }
        );

        // Criar usuário (validação completa)
        await app.post('/api/users', 
            validate({
                body: {
                    name: { 
                        type: 'string', 
                        required: true, 
                        minLength: 3,
                        maxLength: 100
                    },
                    email: { 
                        type: 'email', 
                        required: true
                    },
                    age: { 
                        type: 'number', 
                        min: 18, 
                        max: 120,
                        message: 'Idade deve estar entre 18 e 120 anos'
                    },
                    role: { 
                        type: 'string', 
                        enum: ['user', 'admin', 'moderator'] 
                    },
                    password: {
                        type: 'string',
                        required: true,
                        custom: (value: string) => {
                            if (value.length < 8) return 'Senha muito curta';
                            if (!/[A-Z]/.test(value)) return 'Falta letra maiúscula';
                            if (!/[0-9]/.test(value)) return 'Falta número';
                            return true;
                        }
                    },
                    website: { type: 'url' },
                    active: { type: 'boolean' }
                }
            }),
            (req: Req, res: Res) => {
                const userData = req.bodyJson;
                
                res.send({ 
                    created: true,
                    user: { 
                        id: '123e4567-e89b-12d3-a456-426614174000',
                        ...userData,
                        password: undefined // Não retornar senha
                    }
                }, { status: 201 });
            }
        );

        // Atualizar usuário (params + body validados)
        await app.put('/api/users/:id', 
            validate({
                params: { id: schemas.uuid },
                body: {
                    name: { type: 'string', minLength: 3 },
                    email: { type: 'email' },
                    age: { type: 'number', min: 18 },
                    website: { type: 'url' }
                }
            }),
            (req: Req, res: Res) => {
                const { id } = req.params!;
                const updates = req.bodyJson;
                
                res.send({ 
                    updated: true,
                    user: { id, ...updates }
                });
            }
        );

        // Deletar usuário
        await app.delete('/api/users/:id', 
            validate({
                params: { id: schemas.uuid }
            }),
            (req: Req, res: Res) => {
                res.send({ deleted: true }, { status: 204 });
            }
        );

        return app.resolve();
    }
};
