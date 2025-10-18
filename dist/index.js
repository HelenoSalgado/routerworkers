function getQueryInPathName(search) {
    if (search.includes('?')) {
        let preQueries = search.replaceAll('%5B', '[').replaceAll('%5D', ']').replaceAll('%20', ' ').slice(1).toString().split('&');
        let queries = {};
        preQueries.forEach((query) => {
            let q = query.split('=');
            function transformQueries(value) {
                if (value == 'true')
                    return queries[q[0]] = true;
                if (value == 'false')
                    return queries[q[0]] = false;
                if (!Number.isNaN(Number.parseInt(value)))
                    return parseInt(value);
                if (q[1].includes('[') && q[1].includes(']')) {
                    let array = q[1].replace('[', '').replace(']', '').split(',');
                    let arrayModify = array.map((value) => {
                        if (value == 'true')
                            return true;
                        if (value == 'false')
                            return false;
                        if (!Number.isNaN(Number.parseInt(value)))
                            return parseInt(value);
                        if (typeof value == "string")
                            return value.replaceAll('%27', '').replaceAll('%22', '');
                        return value;
                    });
                    return arrayModify;
                }
                if (typeof value == "string")
                    return value.replaceAll('%27', '').replaceAll('%22', '');
                return value;
            }
            queries[q[0]] = transformQueries(q[1]);
        });
        return queries;
    }
    else {
        return undefined;
    }
}

/**
 * RouteParser - Parser simples e eficiente para rotas aninhadas
 * Converte rotas com parâmetros em regex para matching
 */
class RouteParser {
    pattern;
    paramNames = [];
    constructor(route) {
        // Extrai nomes dos parâmetros e cria pattern regex
        const regexPattern = route
            .replace(/\//g, '\\/') // Escapa barras
            .replace(/:(\w+)/g, (_, paramName) => {
            this.paramNames.push(paramName);
            return '([^\\/]+)'; // Captura qualquer coisa exceto /
        });
        this.pattern = new RegExp(`^${regexPattern}$`);
    }
    /**
     * Verifica se o pathname corresponde à rota e extrai parâmetros
     */
    match(pathname) {
        const matches = pathname.match(this.pattern);
        if (!matches) {
            return { matched: false, params: {} };
        }
        // Mapeia valores capturados para nomes dos parâmetros
        const params = {};
        this.paramNames.forEach((name, index) => {
            params[name] = decodeURIComponent(matches[index + 1]);
        });
        return { matched: true, params };
    }
}

/**
 * Validador Built-in do RouterWorkers
 * Zero dependências, simples e poderoso
 */
/**
 * Erro de validação
 */
class ValidationError extends Error {
    field;
    code;
    constructor(field, message, code) {
        super(message);
        this.field = field;
        this.code = code;
        this.name = 'ValidationError';
    }
}
/**
 * Valida um valor contra uma regra
 */
function validateValue(value, rule, fieldName) {
    // Required check
    if (rule.required && (value === undefined || value === null || value === '')) {
        return new ValidationError(fieldName, rule.message || `${fieldName} is required`, 'required');
    }
    // Se não é required e está vazio, skip outras validações
    if (value === undefined || value === null) {
        return null;
    }
    // Type validation
    if (rule.type) {
        switch (rule.type) {
            case 'string':
                if (typeof value !== 'string') {
                    return new ValidationError(fieldName, rule.message || `${fieldName} must be a string`, 'invalid_type');
                }
                break;
            case 'number':
                const num = typeof value === 'string' ? parseFloat(value) : value;
                if (typeof num !== 'number' || isNaN(num)) {
                    return new ValidationError(fieldName, rule.message || `${fieldName} must be a number`, 'invalid_type');
                }
                value = num; // Coerce para number
                break;
            case 'boolean':
                if (typeof value !== 'boolean') {
                    // Aceita 'true'/'false' strings
                    if (value === 'true' || value === 'false') {
                        value = value === 'true';
                    }
                    else {
                        return new ValidationError(fieldName, rule.message || `${fieldName} must be a boolean`, 'invalid_type');
                    }
                }
                break;
            case 'email':
                if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    return new ValidationError(fieldName, rule.message || `${fieldName} must be a valid email`, 'invalid_email');
                }
                break;
            case 'url':
                if (typeof value !== 'string') {
                    return new ValidationError(fieldName, rule.message || `${fieldName} must be a string`, 'invalid_type');
                }
                try {
                    new URL(value);
                }
                catch {
                    return new ValidationError(fieldName, rule.message || `${fieldName} must be a valid URL`, 'invalid_url');
                }
                break;
            case 'uuid':
                if (typeof value !== 'string' ||
                    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
                    return new ValidationError(fieldName, rule.message || `${fieldName} must be a valid UUID`, 'invalid_uuid');
                }
                break;
            case 'array':
                if (!Array.isArray(value)) {
                    return new ValidationError(fieldName, rule.message || `${fieldName} must be an array`, 'invalid_type');
                }
                break;
            case 'object':
                if (typeof value !== 'object' || Array.isArray(value) || value === null) {
                    return new ValidationError(fieldName, rule.message || `${fieldName} must be an object`, 'invalid_type');
                }
                break;
        }
    }
    // Min/Max para números
    if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
            return new ValidationError(fieldName, rule.message || `${fieldName} must be at least ${rule.min}`, 'too_small');
        }
        if (rule.max !== undefined && value > rule.max) {
            return new ValidationError(fieldName, rule.message || `${fieldName} must be at most ${rule.max}`, 'too_large');
        }
    }
    // MinLength/MaxLength para strings e arrays
    if (typeof value === 'string' || Array.isArray(value)) {
        if (rule.minLength !== undefined && value.length < rule.minLength) {
            return new ValidationError(fieldName, rule.message || `${fieldName} must have at least ${rule.minLength} characters`, 'too_short');
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
            return new ValidationError(fieldName, rule.message || `${fieldName} must have at most ${rule.maxLength} characters`, 'too_long');
        }
    }
    // Pattern para strings
    if (typeof value === 'string' && rule.pattern) {
        if (!rule.pattern.test(value)) {
            return new ValidationError(fieldName, rule.message || `${fieldName} does not match required pattern`, 'invalid_pattern');
        }
    }
    // Enum check
    if (rule.enum && !rule.enum.includes(value)) {
        return new ValidationError(fieldName, rule.message || `${fieldName} must be one of: ${rule.enum.join(', ')}`, 'invalid_enum');
    }
    // Custom validator
    if (rule.custom) {
        const result = rule.custom(value);
        if (result !== true) {
            return new ValidationError(fieldName, typeof result === 'string' ? result : (rule.message || `${fieldName} failed custom validation`), 'custom_validation');
        }
    }
    return null;
}
/**
 * Valida um objeto contra um schema
 */
function validateObject(data, schema) {
    const errors = [];
    for (const [field, rule] of Object.entries(schema)) {
        const value = data?.[field];
        const error = validateValue(value, rule, field);
        if (error) {
            errors.push(error);
        }
    }
    return errors;
}
/**
 * Cria middleware de validação
 *
 * @example
 * ```typescript
 * import { validate } from 'routerworkers';
 *
 * app.post('/users', validate({
 *   body: {
 *     name: { type: 'string', required: true, minLength: 3 },
 *     email: { type: 'email', required: true },
 *     age: { type: 'number', min: 18, max: 120 }
 *   }
 * }), handler);
 * ```
 */
function validate(config) {
    return async (req, res) => {
        const allErrors = [];
        // Valida body
        if (config.body && req.bodyJson) {
            const errors = validateObject(req.bodyJson, config.body);
            allErrors.push(...errors);
        }
        // Valida params
        if (config.params && req.params) {
            const errors = validateObject(req.params, config.params);
            allErrors.push(...errors);
        }
        // Valida queries
        if (config.queries && req.queries) {
            const errors = validateObject(req.queries, config.queries);
            allErrors.push(...errors);
        }
        // Se há erros, chama handler customizado ou padrão
        if (allErrors.length > 0) {
            if (config.onError) {
                config.onError(allErrors, req, res);
            }
            else {
                // Handler padrão: retorna erros estruturados
                res.send({
                    error: 'Validation failed',
                    issues: allErrors.map(err => ({
                        field: err.field,
                        message: err.message,
                        code: err.code
                    }))
                }, { status: 400 });
            }
        }
    };
}
/**
 * Schemas pré-definidos úteis
 */
const schemas = {
    /**
     * Schema para UUID
     */
    uuid: { type: 'uuid', required: true },
    /**
     * Schema para email
     */
    email: { type: 'email', required: true },
    /**
     * Schema para URL
     */
    url: { type: 'url', required: true },
    /**
     * Schema para paginação
     */
    pagination: {
        page: { type: 'number', min: 1 },
        limit: { type: 'number', min: 1, max: 100 }
    }
};

/**
 * CORS Middleware para RouterWorkers
 * Configuração flexível e compatível com Cloudflare Workers
 */
/**
 * Cria middleware CORS
 *
 * @example
 * ```typescript
 * import { cors } from 'routerworkers';
 *
 * // CORS simples (permite tudo)
 * await app.use(cors());
 *
 * // CORS configurado
 * await app.use(cors({
 *   origin: 'https://example.com',
 *   credentials: true
 * }));
 * ```
 */
function cors(options = {}) {
    const { origin = '*', methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], allowedHeaders = ['Content-Type', 'Authorization'], exposedHeaders = [], credentials = false, maxAge = 86400 } = options;
    return async (req, res) => {
        const requestOrigin = req.headers.get('Origin') || '';
        // Determinar se a origin é permitida
        let allowOrigin = '*';
        if (typeof origin === 'string') {
            allowOrigin = origin;
        }
        else if (Array.isArray(origin)) {
            if (origin.includes(requestOrigin)) {
                allowOrigin = requestOrigin;
            }
        }
        else if (typeof origin === 'function') {
            if (origin(requestOrigin)) {
                allowOrigin = requestOrigin;
            }
        }
        // Se a requisição é OPTIONS (preflight), responder diretamente
        if (req.method === 'OPTIONS') {
            // Responder ao preflight com 204 No Content
            res.noContent();
            return;
        }
        // Para outras requisições, adicionar headers CORS à resposta
        // Guardamos as configs para aplicar depois quando a response for criada
        req.__corsHeaders = {
            'Access-Control-Allow-Origin': allowOrigin,
            ...(credentials ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
            ...(exposedHeaders.length > 0 ? { 'Access-Control-Expose-Headers': exposedHeaders.join(', ') } : {})
        };
    };
}
/**
 * CORS preset para desenvolvimento (permite tudo)
 */
function corsDevMode() {
    return cors({
        origin: '*',
        credentials: false,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']
    });
}
/**
 * CORS preset para produção (restritivo)
 */
function corsProduction(allowedOrigins) {
    return cors({
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 86400
    });
}

/**
 * Route Groups para RouterWorkers
 * Permite agrupar rotas com prefixos e middlewares compartilhados
 */
/**
 * Classe para gerenciar grupos de rotas
 */
class RouteGroup {
    app;
    config;
    constructor(app, config = {}) {
        this.app = app;
        this.config = config;
    }
    /**
     * Prefixo completo considerando grupos aninhados
     */
    getFullPrefix() {
        return this.config.prefix || '';
    }
    /**
     * Combina middlewares do grupo com middlewares da rota
     */
    combineMiddlewares(routeMiddlewares) {
        const groupMiddlewares = this.config.middlewares || [];
        return [...groupMiddlewares, ...routeMiddlewares];
    }
    /**
     * Adiciona prefixo ao path
     */
    prefixPath(path) {
        const prefix = this.getFullPrefix();
        if (!prefix)
            return path;
        // Remove trailing slash do prefix e leading slash do path
        const cleanPrefix = prefix.replace(/\/$/, '');
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${cleanPrefix}${cleanPath}`;
    }
    /**
     * Registra rota GET no grupo
     */
    async get(path, ...args) {
        const fullPath = this.prefixPath(path);
        const handler = args[args.length - 1];
        const routeMiddlewares = args.slice(0, -1);
        const allMiddlewares = this.combineMiddlewares(routeMiddlewares);
        await this.app.get(fullPath, ...allMiddlewares, handler);
    }
    /**
     * Registra rota POST no grupo
     */
    async post(path, ...args) {
        const fullPath = this.prefixPath(path);
        const handler = args[args.length - 1];
        const routeMiddlewares = args.slice(0, -1);
        const allMiddlewares = this.combineMiddlewares(routeMiddlewares);
        await this.app.post(fullPath, ...allMiddlewares, handler);
    }
    /**
     * Registra rota PUT no grupo
     */
    async put(path, ...args) {
        const fullPath = this.prefixPath(path);
        const handler = args[args.length - 1];
        const routeMiddlewares = args.slice(0, -1);
        const allMiddlewares = this.combineMiddlewares(routeMiddlewares);
        await this.app.put(fullPath, ...allMiddlewares, handler);
    }
    /**
     * Registra rota DELETE no grupo
     */
    async delete(path, ...args) {
        const fullPath = this.prefixPath(path);
        const handler = args[args.length - 1];
        const routeMiddlewares = args.slice(0, -1);
        const allMiddlewares = this.combineMiddlewares(routeMiddlewares);
        await this.app.delete(fullPath, ...allMiddlewares, handler);
    }
    /**
     * Cria um subgrupo aninhado
     */
    group(config, callback) {
        const nestedPrefix = this.getFullPrefix() + (config.prefix || '');
        const nestedMiddlewares = [
            ...(this.config.middlewares || []),
            ...(config.middlewares || [])
        ];
        const nestedGroup = new RouteGroup(this.app, {
            prefix: nestedPrefix,
            middlewares: nestedMiddlewares
        });
        return callback(nestedGroup);
    }
}
/**
 * Cria um grupo de rotas
 *
 * @example
 * ```typescript
 * import { group } from 'routerworkers';
 *
 * await group(app, { prefix: '/api' }, async (api) => {
 *   await api.get('/users', handler);
 *   // Rota: GET /api/users
 * });
 * ```
 */
async function group(app, config, callback) {
    const routeGroup = new RouteGroup(app, config);
    await callback(routeGroup);
}

class RouterWorkers {
    method;
    url;
    incrementRoute = [];
    config;
    resolved = false;
    routeParsers = new Map(); // Cache de parsers
    errorHandler;
    notFoundHandler;
    req;
    response; // Será inicializado no res.send ou res.redirect
    res = {
        send: (data, config) => {
            if (typeof data == "object") {
                this.response = Response.json(data, config);
            }
            else {
                this.response = new Response(data, config);
            }
            this.resolved = true;
        },
        redirect: (url, status) => {
            this.response = Response.redirect(url, status);
            this.resolved = true;
        },
        // ✨ Response Helpers - Fase 3
        ok: (data) => {
            this.response = Response.json(data, { status: 200 });
            this.resolved = true;
        },
        created: (data, location) => {
            const headers = location ? { Location: location } : undefined;
            this.response = Response.json(data, { status: 201, headers });
            this.resolved = true;
        },
        accepted: (data) => {
            this.response = Response.json(data || { message: 'Accepted' }, { status: 202 });
            this.resolved = true;
        },
        noContent: () => {
            this.response = new Response(null, { status: 204 });
            this.resolved = true;
        },
        badRequest: (error) => {
            const body = typeof error === 'string' ? { error } : error;
            this.response = Response.json(body, { status: 400 });
            this.resolved = true;
        },
        unauthorized: (error) => {
            this.response = Response.json({
                error: error || 'Unauthorized'
            }, { status: 401 });
            this.resolved = true;
        },
        forbidden: (error) => {
            this.response = Response.json({
                error: error || 'Forbidden'
            }, { status: 403 });
            this.resolved = true;
        },
        notFound: (error) => {
            this.response = Response.json({
                error: error || 'Not Found'
            }, { status: 404 });
            this.resolved = true;
        },
        conflict: (error) => {
            const body = typeof error === 'string' ? { error } : error;
            this.response = Response.json(body, { status: 409 });
            this.resolved = true;
        },
        unprocessable: (errors) => {
            this.response = Response.json({
                error: 'Validation failed',
                issues: errors
            }, { status: 422 });
            this.resolved = true;
        },
        serverError: (error) => {
            this.response = Response.json({
                error: error || 'Internal Server Error'
            }, { status: 500 });
            this.resolved = true;
        },
        json: (data, status = 200) => {
            this.response = Response.json(data, { status });
            this.resolved = true;
        },
        html: (content, status = 200) => {
            this.response = new Response(content, {
                status,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
            this.resolved = true;
        },
        text: (content, status = 200) => {
            this.response = new Response(content, {
                status,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
            this.resolved = true;
        }
    };
    constructor(request, config) {
        this.url = new URL(request.url);
        this.method = request.method;
        this.config = config;
        this.req = new Request(request);
    }
    /**
     * Registra handler de erro global
     * Chamado automaticamente quando ocorre um erro não tratado
     */
    onError(handler) {
        this.errorHandler = handler;
    }
    /**
     * Registra handler customizado para 404 (rota não encontrada)
     */
    notFound(handler) {
        this.notFoundHandler = handler;
    }
    /**
     * Registra middlewares globais
     * Executados antes de qualquer rota
     */
    async use(...args) {
        for (let i = 0; i < args.length; i++) {
            let middleware = args[i];
            if (this.resolved)
                return;
            try {
                await middleware(this.req, this.res);
            }
            catch (error) {
                await this.handleError(error);
                return;
            }
        }
        return;
    }
    async get(...args) {
        if (!this.resolved && this.method == 'GET' && this.isPathName(args[0])) {
            this.req.queries = getQueryInPathName(this.url.search);
            await this.foreachMiddleware(args);
            if (this.resolved)
                return;
            let cbResult = args[args.length - 1];
            let isPathNameInCache = false;
            for (let pathname of this.config?.cache?.pathname || []) {
                if (pathname.includes(',') && pathname.split(',')[0] == args[0]) {
                    let pathNameAndTime = pathname.split(',');
                    isPathNameInCache = pathNameAndTime[0] == args[0] ? true : false;
                    if (this.config?.cache) {
                        this.config.cache.maxage = pathNameAndTime[1];
                    }
                    break;
                }
                else if (pathname == args[0]) {
                    isPathNameInCache = true;
                    break;
                }
            }
            return isPathNameInCache
                ? await this.setCache(cbResult)
                : await this.executeHandler(cbResult);
        }
        else {
            this.incrementRoute.push(args[0]);
        }
    }
    async post(...args) {
        if (!this.resolved && this.method == 'POST' && this.isPathName(args[0])) {
            try {
                this.req.bodyJson = await this.req.json();
            }
            catch (error) {
                this.req.bodyJson = undefined;
            }
            await this.foreachMiddleware(args);
            if (this.resolved)
                return;
            let cbResult = args[args.length - 1];
            return await this.executeHandler(cbResult);
        }
        else {
            this.incrementRoute.push(args[0]);
        }
    }
    async put(...args) {
        if (!this.resolved && this.method == 'PUT' && this.isPathName(args[0])) {
            try {
                this.req.bodyJson = await this.req.json();
            }
            catch (error) {
                this.req.bodyJson = undefined;
            }
            await this.foreachMiddleware(args);
            if (this.resolved)
                return;
            await this.removeCache(args[0]);
            let cbResult = args[args.length - 1];
            return await this.executeHandler(cbResult);
        }
        else {
            this.incrementRoute.push(args[0]);
        }
    }
    async delete(...args) {
        if (!this.resolved && this.method == 'DELETE' && this.isPathName(args[0])) {
            await this.foreachMiddleware(args);
            if (this.resolved)
                return;
            await this.removeCache(args[0]);
            let cbResult = args[args.length - 1];
            return await this.executeHandler(cbResult);
        }
        else {
            this.incrementRoute.push(args[0]);
        }
    }
    /**
     * Verifica se o pathname da requisição corresponde à rota
     * Suporta rotas aninhadas: /api/users/:userId/posts/:postId
     */
    isPathName(path) {
        // Rota exata (sem parâmetros)
        if (this.url.pathname === path) {
            return true;
        }
        // Rota com parâmetros - usa RouteParser
        if (path.includes(':')) {
            // Reutiliza parser se já existe (performance)
            if (!this.routeParsers.has(path)) {
                this.routeParsers.set(path, new RouteParser(path));
            }
            const parser = this.routeParsers.get(path);
            const match = parser.match(this.url.pathname);
            if (match.matched) {
                // Injeta params no req (plural - mais intuitivo)
                this.req.params = match.params;
                // Mantém param para backward compatibility
                this.req.param = match.params;
                return true;
            }
        }
        return false;
    }
    /**
     * Executa middlewares de rota com tratamento de erros
     */
    async foreachMiddleware(args) {
        for (let i = 1; i < args.length - 1; i++) {
            if (this.resolved)
                return;
            let middleware = args[i];
            try {
                await middleware(this.req, this.res);
            }
            catch (error) {
                await this.handleError(error);
                return;
            }
        }
        return;
    }
    /**
     * Executa handler de rota com tratamento de erros
     */
    async executeHandler(handler) {
        try {
            await handler(this.req, this.res);
        }
        catch (error) {
            await this.handleError(error);
        }
    }
    /**
     * Processa erros usando handler customizado ou padrão
     */
    async handleError(error) {
        if (this.errorHandler) {
            try {
                await this.errorHandler(error, this.req, this.res);
            }
            catch (handlerError) {
                // Se o error handler falhar, usar resposta padrão
                this.res.send({ error: 'Internal Server Error' }, { status: 500 });
            }
        }
        else {
            // Handler padrão
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Internal Server Error';
            this.res.send({ error: message }, { status: statusCode });
        }
    }
    async setCache(callback) {
        const cache = caches.default;
        const cacheKey = new Request(this.req.url, { method: 'GET' });
        let response = await cache.match(cacheKey);
        if (!response) {
            await this.executeHandler(callback);
            if (this.response) {
                this.response.headers.append('Cache-Control', 's-maxage=' + this.config.cache.maxage);
                await cache.put(cacheKey, this.response.clone());
            }
            return;
        }
        // Retorna resposta em cache
        return this.res.send(await response.json());
    }
    async removeCache(pathname) {
        if (this.config?.cache?.pathname && this.config.cache.pathname.length > 0 && this.config.cache.pathname.includes(pathname)) {
            const cacheKey = new Request(this.req.url, { method: 'GET' });
            await caches.default.delete(cacheKey);
        }
        return;
    }
    /**
     * Resolve e retorna a Response final
     * Deve ser chamado como último método (return app.resolve())
     */
    resolve() {
        if (!this.response) {
            // Verifica se alguma rota corresponde ao pathname
            const matched = this.incrementRoute.some(pathname => this.isPathName(pathname));
            if (!matched) {
                // Usa handler customizado ou padrão para 404
                if (this.notFoundHandler) {
                    try {
                        this.notFoundHandler(this.req, this.res);
                    }
                    catch (error) {
                        // Fallback se o handler falhar
                        this.res.send({ error: 'Not Found', path: this.url.pathname }, { status: 404 });
                    }
                }
                else {
                    // Handler padrão de 404
                    this.res.send({ error: 'Not Found', path: this.url.pathname }, { status: 404 });
                }
            }
        }
        return this.response;
    }
}
// Middlewares
// export function expurgCache(req: Req, res: Res){
//     let cacheKey = new Request(req.url, {method: 'GET'});
//     caches.default.delete(cacheKey);
// }

export { RouteGroup, RouterWorkers, ValidationError, cors, corsDevMode, corsProduction, group, schemas, validate };
