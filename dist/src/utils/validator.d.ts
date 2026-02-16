/**
 * Validador Built-in do RouterWorkers
 * Zero dependências, simples e poderoso
 */
import type { Req, Res, Middleware } from '../../types/index';
/**
 * Regra de validação para um campo
 */
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
    message?: string;
}
/**
 * Schema de validação (objeto com regras por campo)
 */
export interface ValidationSchema {
    [field: string]: ValidationRule;
}
/**
 * Configuração de validação para diferentes partes da request
 */
export interface ValidateConfig {
    body?: ValidationSchema;
    params?: ValidationSchema;
    queries?: ValidationSchema;
    /**
     * Handler customizado de erro de validação
     */
    onError?: (errors: ValidationError[], req: Req, res: Res) => void;
}
/**
 * Erro de validação
 */
export declare class ValidationError extends Error {
    field: string;
    code?: string | undefined;
    constructor(field: string, message: string, code?: string | undefined);
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
export declare function validate(config: ValidateConfig): Middleware;
/**
 * Schemas pré-definidos úteis
 */
export declare const schemas: {
    /**
     * Schema para UUID
     */
    uuid: {
        type: "uuid";
        required: boolean;
    };
    /**
     * Schema para email
     */
    email: {
        type: "email";
        required: boolean;
    };
    /**
     * Schema para URL
     */
    url: {
        type: "url";
        required: boolean;
    };
    /**
     * Schema para paginação
     */
    pagination: {
        page: {
            type: "number";
            min: number;
        };
        limit: {
            type: "number";
            min: number;
            max: number;
        };
    };
};
//# sourceMappingURL=validator.d.ts.map