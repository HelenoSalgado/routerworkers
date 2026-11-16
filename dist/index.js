/**
 * RouteParser - Parser seguro e eficiente para rotas estáticas e parametrizadas
 * Opera segmento a segmento com suporte a UTF-8, escape de RegExp e proteção contra URIError
 */
const REGEX_META_CHARS = /[.*+?^${}()|[\]\\]/g;
const PARAM_PATTERN = /:([a-zA-Z_]\w*)/g;
/**
 * Escapa todos os metacaracteres de expressão regular em um trecho literal.
 */
function escapeRegExp(value) {
    return value.replace(REGEX_META_CHARS, '\\$&');
}
/**
 * Verifica se uma chave pode causar prototype pollution.
 */
function isDangerousKey(key) {
    return key === '__proto__' || key === 'constructor' || key === 'prototype';
}
/**
 * Decodifica um componente de URI com segurança, retornando null em caso de URIError.
 */
function safeDecodeURIComponent(segment) {
    try {
        return decodeURIComponent(segment);
    }
    catch {
        return null;
    }
}
/**
 * Compara um pathname de requisição com uma rota estática (sem parâmetros),
 * decodificando segmento a segmento para suportar caracteres não-ASCII e
 * rejeitar sequências percentuais malformadas sem lançar exceções.
 */
function matchStaticPath(requestPathname, routePath) {
    if (requestPathname === routePath) {
        return true;
    }
    const reqSegments = requestPathname.split('/');
    const routeSegments = routePath.split('/');
    if (reqSegments.length !== routeSegments.length) {
        return false;
    }
    for (let i = 0; i < routeSegments.length; i++) {
        const decodedRoute = safeDecodeURIComponent(routeSegments[i]);
        if (decodedRoute === null) {
            if (reqSegments[i] !== routeSegments[i]) {
                return false;
            }
            continue;
        }
        const decodedReq = safeDecodeURIComponent(reqSegments[i]);
        if (decodedReq === null || decodedReq !== decodedRoute) {
            return false;
        }
    }
    return true;
}
class RouteParser {
    segments;
    constructor(route) {
        this.segments = route
            .split('/')
            .map((segment) => this.compileSegment(segment));
    }
    compileSegment(segment) {
        const paramMatches = Array.from(segment.matchAll(PARAM_PATTERN));
        if (paramMatches.length === 0) {
            const decoded = safeDecodeURIComponent(segment);
            return {
                kind: 'literal',
                value: decoded ?? segment,
                rawOnly: decoded === null,
            };
        }
        if (paramMatches.length === 1 && paramMatches[0][0] === segment) {
            return {
                kind: 'param',
                name: paramMatches[0][1],
            };
        }
        let regexSource = '^';
        let cursor = 0;
        const paramNames = [];
        for (const match of paramMatches) {
            const matchIndex = match.index ?? 0;
            if (matchIndex > cursor) {
                const rawLiteral = segment.slice(cursor, matchIndex);
                const decodedLiteral = safeDecodeURIComponent(rawLiteral) ?? rawLiteral;
                regexSource += escapeRegExp(decodedLiteral);
            }
            paramNames.push(match[1]);
            regexSource += '([\\s\\S]+)';
            cursor = matchIndex + match[0].length;
        }
        if (cursor < segment.length) {
            const rawTrailing = segment.slice(cursor);
            const decodedTrailing = safeDecodeURIComponent(rawTrailing) ?? rawTrailing;
            regexSource += escapeRegExp(decodedTrailing);
        }
        regexSource += '$';
        return {
            kind: 'mixed',
            pattern: new RegExp(regexSource),
            paramNames,
        };
    }
    /**
     * Verifica se o pathname corresponde à rota e extrai parâmetros com segurança.
     */
    match(pathname) {
        const reqSegments = pathname.split('/');
        if (reqSegments.length !== this.segments.length) {
            return { matched: false, params: {} };
        }
        const params = {};
        for (let i = 0; i < this.segments.length; i++) {
            const compiled = this.segments[i];
            const rawReqSegment = reqSegments[i];
            if (compiled.kind === 'literal') {
                if (compiled.rawOnly) {
                    if (rawReqSegment !== compiled.value) {
                        return { matched: false, params: {} };
                    }
                    continue;
                }
                const decodedReq = safeDecodeURIComponent(rawReqSegment);
                if (decodedReq === null || decodedReq !== compiled.value) {
                    return { matched: false, params: {} };
                }
                continue;
            }
            const decodedReq = safeDecodeURIComponent(rawReqSegment);
            if (decodedReq === null || decodedReq === '') {
                return { matched: false, params: {} };
            }
            if (compiled.kind === 'param') {
                if (!isDangerousKey(compiled.name)) {
                    params[compiled.name] = decodedReq;
                }
                continue;
            }
            const matches = compiled.pattern.exec(decodedReq);
            if (!matches) {
                return { matched: false, params: {} };
            }
            for (let j = 0; j < compiled.paramNames.length; j++) {
                const paramName = compiled.paramNames[j];
                if (!isDangerousKey(paramName)) {
                    params[paramName] = matches[j + 1];
                }
            }
        }
        return { matched: true, params };
    }
}

function parseScalarQueryValue(value) {
    if (value === 'true')
        return true;
    if (value === 'false')
        return false;
    if (value !== '' && /^-?\d+(\.\d+)?$/.test(value))
        return Number(value);
    return value.replaceAll('%27', '').replaceAll('%22', '');
}
function transformQueryValue(rawVal) {
    const decoded = (safeDecodeURIComponent(rawVal) ?? rawVal)
        .replaceAll('%5B', '[')
        .replaceAll('%5D', ']')
        .replaceAll('%20', ' ');
    if (decoded.includes('[') && decoded.includes(']')) {
        const inner = decoded.replace('[', '').replace(']', '');
        if (inner === '')
            return [];
        return inner.split(',').map((item) => {
            const decodedItem = safeDecodeURIComponent(item) ?? item;
            return parseScalarQueryValue(decodedItem);
        });
    }
    return parseScalarQueryValue(decoded);
}
function getQueryInPathName(search) {
    if (!search || !search.includes('?')) {
        return undefined;
    }
    const rawSearch = search.slice(search.indexOf('?') + 1);
    if (!rawSearch) {
        return undefined;
    }
    const pairs = rawSearch.split('&');
    const queries = {};
    let hasEntries = false;
    for (const pair of pairs) {
        if (!pair)
            continue;
        const eqIndex = pair.indexOf('=');
        const rawKey = eqIndex === -1 ? pair : pair.slice(0, eqIndex);
        const rawVal = eqIndex === -1 ? '' : pair.slice(eqIndex + 1);
        const key = (safeDecodeURIComponent(rawKey) ?? rawKey)
            .replaceAll('%5B', '[')
            .replaceAll('%5D', ']')
            .replaceAll('%20', ' ');
        if (!key || isDangerousKey(key)) {
            continue;
        }
        queries[key] = transformQueryValue(rawVal);
        hasEntries = true;
    }
    return hasEntries ? queries : undefined;
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
    if (rule.required &&
        (value === undefined || value === null || value === '')) {
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
            case 'number': {
                const num = typeof value === 'string' ? parseFloat(value) : value;
                if (typeof num !== 'number' || isNaN(num)) {
                    return new ValidationError(fieldName, rule.message || `${fieldName} must be a number`, 'invalid_type');
                }
                value = num; // Coerce para number
                break;
            }
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
                if (typeof value !== 'string' ||
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
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
                if (typeof value !== 'object' ||
                    Array.isArray(value) ||
                    value === null) {
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
            return new ValidationError(fieldName, rule.message ||
                `${fieldName} must have at least ${rule.minLength} characters`, 'too_short');
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
            return new ValidationError(fieldName, rule.message ||
                `${fieldName} must have at most ${rule.maxLength} characters`, 'too_long');
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
            return new ValidationError(fieldName, typeof result === 'string'
                ? result
                : rule.message || `${fieldName} failed custom validation`, 'custom_validation');
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
        if (config.body) {
            const errors = validateObject(req.bodyJson ?? {}, config.body);
            allErrors.push(...errors);
        }
        // Valida params
        if (config.params) {
            const errors = validateObject(req.params ?? {}, config.params);
            allErrors.push(...errors);
        }
        // Valida queries
        if (config.queries) {
            const errors = validateObject(req.queries ?? {}, config.queries);
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
                    issues: allErrors.map((err) => ({
                        field: err.field,
                        message: err.message,
                        code: err.code,
                    })),
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
        limit: { type: 'number', min: 1, max: 100 },
    },
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
    const { origin = '*', methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], allowedHeaders = ['Content-Type', 'Authorization'], exposedHeaders = [], credentials = false, maxAge = 86400, } = options;
    return async (req, res) => {
        const requestOrigin = req.headers.get('Origin') || '';
        // Determinar se a origin é permitida
        let allowOrigin = '';
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
            const headers = {
                ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
                'Access-Control-Allow-Methods': methods.join(', '),
                'Access-Control-Allow-Headers': allowedHeaders.join(', '),
                'Access-Control-Max-Age': String(maxAge),
                ...(credentials && allowOrigin
                    ? { 'Access-Control-Allow-Credentials': 'true' }
                    : {}),
            };
            // Responder ao preflight com 204 No Content e os headers corretos
            res.send(null, { status: 204, headers });
            return;
        }
        // Para outras requisições, adicionar headers CORS à resposta
        // Guardamos as configs para aplicar depois quando a response for criada
        req.__corsHeaders = {
            ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
            ...(credentials && allowOrigin
                ? { 'Access-Control-Allow-Credentials': 'true' }
                : {}),
            ...(exposedHeaders.length > 0 && allowOrigin
                ? { 'Access-Control-Expose-Headers': exposedHeaders.join(', ') }
                : {}),
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
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
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
        maxAge: 86400,
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
        // Remove trailing slash do prefix e normaliza barra inicial do path
        const cleanPrefix = prefix.replace(/\/+$/, '');
        if (!path || path === '/') {
            return cleanPrefix || '/';
        }
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
        const nestedPrefix = config.prefix
            ? this.prefixPath(config.prefix)
            : this.getFullPrefix();
        const nestedMiddlewares = [
            ...(this.config.middlewares || []),
            ...(config.middlewares || []),
        ];
        const nestedGroup = new RouteGroup(this.app, {
            prefix: nestedPrefix,
            middlewares: nestedMiddlewares,
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
            if (data !== null && typeof data == 'object') {
                this.response = Response.json(data, config);
            }
            else if (typeof data === 'string' &&
                this.config?.defaultResponseType === 'json') {
                const status = config?.status ?? 200;
                const payload = status >= 400 ? { error: data } : { message: data };
                this.response = Response.json(payload, config);
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
            this.response = Response.json(data || { message: 'Accepted' }, {
                status: 202,
            });
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
                error: error || 'Unauthorized',
            }, { status: 401 });
            this.resolved = true;
        },
        forbidden: (error) => {
            this.response = Response.json({
                error: error || 'Forbidden',
            }, { status: 403 });
            this.resolved = true;
        },
        notFound: (error) => {
            this.response = Response.json({
                error: error || 'Not Found',
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
                issues: errors,
            }, { status: 422 });
            this.resolved = true;
        },
        serverError: (error) => {
            this.response = Response.json({
                error: error || 'Internal Server Error',
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
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
            this.resolved = true;
        },
        text: (content, status = 200) => {
            this.response = new Response(content, {
                status,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
            this.resolved = true;
        },
    };
    constructor(request, config) {
        this.url = new URL(request.url);
        this.method = request.method;
        this.config = config;
        this.req = new Request(request);
        this.req.queries = getQueryInPathName(this.url.search);
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
            const middleware = args[i];
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
            const cbResult = args[args.length - 1];
            let isPathNameInCache = false;
            for (const pathname of this.config?.cache?.pathname || []) {
                if (pathname.includes(',') && pathname.split(',')[0] == args[0]) {
                    const pathNameAndTime = pathname.split(',');
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
            catch {
                this.req.bodyJson = undefined;
            }
            await this.foreachMiddleware(args);
            if (this.resolved)
                return;
            const cbResult = args[args.length - 1];
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
            catch {
                this.req.bodyJson = undefined;
            }
            await this.foreachMiddleware(args);
            if (this.resolved)
                return;
            await this.removeCache(args[0]);
            const cbResult = args[args.length - 1];
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
            const cbResult = args[args.length - 1];
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
        // Rota sem parâmetros: comparação direta ou decodificada segmento a segmento
        if (!path.includes(':')) {
            if (matchStaticPath(this.url.pathname, path)) {
                this.req.params = undefined;
                this.req.param = undefined;
                return true;
            }
            return false;
        }
        // Rota com parâmetros (ou ':' literal) - usa RouteParser
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
        return false;
    }
    /**
     * Executa middlewares de rota com tratamento de erros
     */
    async foreachMiddleware(args) {
        for (let i = 1; i < args.length - 1; i++) {
            if (this.resolved)
                return;
            const middleware = args[i];
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
            catch {
                // Se o error handler falhar, usar resposta padrão
                this.res.send({ error: 'Internal Server Error' }, { status: 500 });
            }
            if (!this.response) {
                this.res.send({ error: 'Internal Server Error' }, { status: 500 });
            }
        }
        else {
            // Handler padrão
            const statusCode = error?.statusCode || 500;
            const message = error?.message || 'Internal Server Error';
            this.res.send({ error: message }, { status: statusCode });
        }
    }
    async setCache(callback) {
        const cacheUrl = this.config?.cache?.version
            ? `${this.req.url}?v=${this.config.cache.version}`
            : this.req.url;
        const cacheKey = new Request(cacheUrl, { method: 'GET' });
        const response = await caches.default.match(cacheKey);
        if (!response) {
            await this.executeHandler(callback);
            if (this.response && this.response.ok) {
                this.response.headers.append('Cache-Control', 's-maxage=' + this.config.cache.maxage);
                await caches.default.put(cacheKey, this.response.clone());
            }
            return;
        }
        // Retorna resposta em cache
        return this.res.send(await response.json());
    }
    async removeCache(pathname) {
        if (this.config?.cache?.pathname &&
            this.config.cache.pathname.length > 0 &&
            this.config.cache.pathname.some((entry) => entry === pathname || entry.split(',')[0] === pathname)) {
            const cacheUrl = this.config?.cache?.version
                ? `${this.req.url}?v=${this.config.cache.version}`
                : this.req.url;
            const cacheKey = new Request(cacheUrl, { method: 'GET' });
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
            // Usa handler customizado ou padrão para 404
            if (this.notFoundHandler) {
                try {
                    this.notFoundHandler(this.req, this.res);
                }
                catch {
                    // Fallback se o handler falhar
                    this.res.send({ error: 'Not Found', path: this.url.pathname }, { status: 404 });
                }
            }
            if (!this.response) {
                // Handler padrão de 404 (ou fallback se notFoundHandler não enviou resposta)
                this.res.send({ error: 'Not Found', path: this.url.pathname }, { status: 404 });
            }
        }
        const corsHeaders = this.req.__corsHeaders;
        if (corsHeaders && this.response) {
            try {
                for (const [key, value] of Object.entries(corsHeaders)) {
                    if (!this.response.headers.has(key)) {
                        this.response.headers.set(key, value);
                    }
                }
            }
            catch {
                // Caso os headers da Response sejam imutáveis (ex: Response.redirect), clona com headers mutáveis
                const clonedHeaders = new Headers(this.response.headers);
                for (const [key, value] of Object.entries(corsHeaders)) {
                    if (!clonedHeaders.has(key)) {
                        clonedHeaders.set(key, value);
                    }
                }
                this.response = new Response(this.response.body, {
                    status: this.response.status,
                    statusText: this.response.statusText,
                    headers: clonedHeaders,
                });
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
//# sourceMappingURL=index.js.map
