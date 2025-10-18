/**
 * Validador Built-in do RouterWorkers
 * Zero dependências, simples e poderoso
 */

import type { Req, Res, Middleware } from "../../types/index";

/**
 * Regra de validação para um campo
 */
export interface ValidationRule {
    type?: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'uuid' | 'array' | 'object';
    required?: boolean;
    min?: number;        // Para números: valor mínimo
    max?: number;        // Para números: valor máximo
    minLength?: number;  // Para strings/arrays: tamanho mínimo
    maxLength?: number;  // Para strings/arrays: tamanho máximo
    pattern?: RegExp;    // Para strings: regex pattern
    enum?: any[];        // Valores permitidos
    custom?: (value: any) => boolean | string; // Validador customizado
    message?: string;    // Mensagem de erro customizada
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
export class ValidationError extends Error {
    constructor(
        public field: string,
        message: string,
        public code?: string
    ) {
        super(message);
        this.name = 'ValidationError';
    }
}

/**
 * Valida um valor contra uma regra
 */
function validateValue(value: any, rule: ValidationRule, fieldName: string): ValidationError | null {
    // Required check
    if (rule.required && (value === undefined || value === null || value === '')) {
        return new ValidationError(
            fieldName,
            rule.message || `${fieldName} is required`,
            'required'
        );
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
                    return new ValidationError(
                        fieldName,
                        rule.message || `${fieldName} must be a string`,
                        'invalid_type'
                    );
                }
                break;

            case 'number':
                const num = typeof value === 'string' ? parseFloat(value) : value;
                if (typeof num !== 'number' || isNaN(num)) {
                    return new ValidationError(
                        fieldName,
                        rule.message || `${fieldName} must be a number`,
                        'invalid_type'
                    );
                }
                value = num; // Coerce para number
                break;

            case 'boolean':
                if (typeof value !== 'boolean') {
                    // Aceita 'true'/'false' strings
                    if (value === 'true' || value === 'false') {
                        value = value === 'true';
                    } else {
                        return new ValidationError(
                            fieldName,
                            rule.message || `${fieldName} must be a boolean`,
                            'invalid_type'
                        );
                    }
                }
                break;

            case 'email':
                if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    return new ValidationError(
                        fieldName,
                        rule.message || `${fieldName} must be a valid email`,
                        'invalid_email'
                    );
                }
                break;

            case 'url':
                if (typeof value !== 'string') {
                    return new ValidationError(
                        fieldName,
                        rule.message || `${fieldName} must be a string`,
                        'invalid_type'
                    );
                }
                try {
                    new URL(value);
                } catch {
                    return new ValidationError(
                        fieldName,
                        rule.message || `${fieldName} must be a valid URL`,
                        'invalid_url'
                    );
                }
                break;

            case 'uuid':
                if (typeof value !== 'string' || 
                    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
                    return new ValidationError(
                        fieldName,
                        rule.message || `${fieldName} must be a valid UUID`,
                        'invalid_uuid'
                    );
                }
                break;

            case 'array':
                if (!Array.isArray(value)) {
                    return new ValidationError(
                        fieldName,
                        rule.message || `${fieldName} must be an array`,
                        'invalid_type'
                    );
                }
                break;

            case 'object':
                if (typeof value !== 'object' || Array.isArray(value) || value === null) {
                    return new ValidationError(
                        fieldName,
                        rule.message || `${fieldName} must be an object`,
                        'invalid_type'
                    );
                }
                break;
        }
    }

    // Min/Max para números
    if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
            return new ValidationError(
                fieldName,
                rule.message || `${fieldName} must be at least ${rule.min}`,
                'too_small'
            );
        }
        if (rule.max !== undefined && value > rule.max) {
            return new ValidationError(
                fieldName,
                rule.message || `${fieldName} must be at most ${rule.max}`,
                'too_large'
            );
        }
    }

    // MinLength/MaxLength para strings e arrays
    if (typeof value === 'string' || Array.isArray(value)) {
        if (rule.minLength !== undefined && value.length < rule.minLength) {
            return new ValidationError(
                fieldName,
                rule.message || `${fieldName} must have at least ${rule.minLength} characters`,
                'too_short'
            );
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
            return new ValidationError(
                fieldName,
                rule.message || `${fieldName} must have at most ${rule.maxLength} characters`,
                'too_long'
            );
        }
    }

    // Pattern para strings
    if (typeof value === 'string' && rule.pattern) {
        if (!rule.pattern.test(value)) {
            return new ValidationError(
                fieldName,
                rule.message || `${fieldName} does not match required pattern`,
                'invalid_pattern'
            );
        }
    }

    // Enum check
    if (rule.enum && !rule.enum.includes(value)) {
        return new ValidationError(
            fieldName,
            rule.message || `${fieldName} must be one of: ${rule.enum.join(', ')}`,
            'invalid_enum'
        );
    }

    // Custom validator
    if (rule.custom) {
        const result = rule.custom(value);
        if (result !== true) {
            return new ValidationError(
                fieldName,
                typeof result === 'string' ? result : (rule.message || `${fieldName} failed custom validation`),
                'custom_validation'
            );
        }
    }

    return null;
}

/**
 * Valida um objeto contra um schema
 */
function validateObject(data: any, schema: ValidationSchema): ValidationError[] {
    const errors: ValidationError[] = [];

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
export function validate(config: ValidateConfig): Middleware {
    return async (req: Req, res: Res) => {
        const allErrors: ValidationError[] = [];

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
            } else {
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
export const schemas = {
    /**
     * Schema para UUID
     */
    uuid: { type: 'uuid' as const, required: true },

    /**
     * Schema para email
     */
    email: { type: 'email' as const, required: true },

    /**
     * Schema para URL
     */
    url: { type: 'url' as const, required: true },

    /**
     * Schema para paginação
     */
    pagination: {
        page: { type: 'number' as const, min: 1 },
        limit: { type: 'number' as const, min: 1, max: 100 }
    }
};
