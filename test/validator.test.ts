import { RouterWorkers, validate, schemas } from '../src/index';
import { Req, Res } from '../types/index';

describe('Fase 2A - Validador Built-in', () => {
  describe('Validação de Body', () => {
    test('Deve validar campos obrigatórios', async () => {
      const request = new Request('http://localhost/users', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const app = new RouterWorkers(request);

      let validationError: any = null;

      await app.post(
        '/users',
        validate({
          body: {
            name: { type: 'string', required: true },
            email: { type: 'email', required: true },
          },
          onError: (errors) => {
            validationError = errors;
          },
        }),
        (req: Req, res: Res) => {
          res.send({ success: true });
        },
      );

      app.resolve();
      expect(validationError).not.toBeNull();
      expect(validationError).toHaveLength(2);
      expect(validationError[0].field).toBe('name');
      expect(validationError[1].field).toBe('email');
    });

    test('Deve validar tipos de dados', async () => {
      const request = new Request('http://localhost/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'John',
          age: 'not-a-number',
        }),
      });
      const app = new RouterWorkers(request);

      let validationError: any = null;

      await app.post(
        '/users',
        validate({
          body: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
          onError: (errors) => {
            validationError = errors;
          },
        }),
        (req: Req, res: Res) => {
          res.send({ success: true });
        },
      );

      app.resolve();
      expect(validationError).not.toBeNull();
      expect(validationError).toHaveLength(1);
      expect(validationError[0].field).toBe('age');
    });

    test('Deve validar email format', async () => {
      const request = new Request('http://localhost/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'invalid-email',
        }),
      });
      const app = new RouterWorkers(request);

      let validationError: any = null;

      await app.post(
        '/users',
        validate({
          body: {
            email: { type: 'email', required: true },
          },
          onError: (errors) => {
            validationError = errors;
          },
        }),
        (req: Req, res: Res) => {
          res.send({ success: true });
        },
      );

      app.resolve();
      expect(validationError).not.toBeNull();
      expect(validationError[0].code).toBe('invalid_email');
    });

    test('Deve validar url format', async () => {
      const request = new Request('http://localhost/links', {
        method: 'POST',
        body: JSON.stringify({
          website: 'not-a-valid-url',
        }),
      });
      const app = new RouterWorkers(request);

      let validationError: any = null;

      await app.post(
        '/links',
        validate({
          body: {
            website: { type: 'url', required: true },
          },
          onError: (errors) => {
            validationError = errors;
          },
        }),
        (req: Req, res: Res) => {
          res.send({ success: true });
        },
      );

      app.resolve();
      expect(validationError).not.toBeNull();
      expect(validationError[0].code).toBe('invalid_url');
    });

    test('Deve passar com url válida', async () => {
      const request = new Request('http://localhost/links', {
        method: 'POST',
        body: JSON.stringify({
          website: 'https://example.com',
        }),
      });
      const app = new RouterWorkers(request);

      let validationError: any = null;

      await app.post(
        '/links',
        validate({
          body: {
            website: { type: 'url', required: true },
          },
          onError: (errors) => {
            validationError = errors;
          },
        }),
        (req: Req, res: Res) => {
          res.send({ success: true });
        },
      );

      app.resolve();
      expect(validationError).toBeNull();
    });

    test('Deve validar o tipo array', async () => {
      const request = new Request('http://localhost/items', {
        method: 'POST',
        body: JSON.stringify({
          tags: 'not-an-array',
        }),
      });
      const app = new RouterWorkers(request);

      let validationError: any = null;

      await app.post(
        '/items',
        validate({
          body: {
            tags: { type: 'array', required: true },
          },
          onError: (errors) => {
            validationError = errors;
          },
        }),
        (req: Req, res: Res) => {
          res.send({ success: true });
        },
      );

      app.resolve();
      expect(validationError).not.toBeNull();
      expect(validationError[0].code).toBe('invalid_type');
      expect(validationError[0].field).toBe('tags');
    });

    test('Deve validar o tipo object', async () => {
      const request = new Request('http://localhost/items', {
        method: 'POST',
        body: JSON.stringify({
          metadata: 'not-an-object',
        }),
      });
      const app = new RouterWorkers(request);

      let validationError: any = null;

      await app.post(
        '/items',
        validate({
          body: {
            metadata: { type: 'object', required: true },
          },
          onError: (errors) => {
            validationError = errors;
          },
        }),
        (req: Req, res: Res) => {
          res.send({ success: true });
        },
      );

      app.resolve();
      expect(validationError).not.toBeNull();
      expect(validationError[0].code).toBe('invalid_type');
      expect(validationError[0].field).toBe('metadata');
    });

    test('Deve validar minLength e maxLength', async () => {
      const request = new Request('http://localhost/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Jo', // muito curto
          bio: 'a'.repeat(201), // muito longo
        }),
      });
      const app = new RouterWorkers(request);

      let validationError: any = null;

      await app.post(
        '/users',
        validate({
          body: {
            name: { type: 'string', minLength: 3 },
            bio: { type: 'string', maxLength: 200 },
          },
          onError: (errors) => {
            validationError = errors;
          },
        }),
        (req: Req, res: Res) => {
          res.send({ success: true });
        },
      );

      app.resolve();
      expect(validationError).toHaveLength(2);
      expect(validationError[0].code).toBe('too_short');
      expect(validationError[1].code).toBe('too_long');
    });

    test('Deve validar min e max para números', async () => {
      const request = new Request('http://localhost/users', {
        method: 'POST',
        body: JSON.stringify({
          age: 15,
        }),
      });
      const app = new RouterWorkers(request);

      let validationError: any = null;

      await app.post(
        '/users',
        validate({
          body: {
            age: { type: 'number', min: 18, max: 120 },
          },
          onError: (errors) => {
            validationError = errors;
          },
        }),
        (req: Req, res: Res) => {
          res.send({ success: true });
        },
      );

      app.resolve();
      expect(validationError).toHaveLength(1);
      expect(validationError[0].code).toBe('too_small');
    });

    test('Deve validar enum values', async () => {
      const request = new Request('http://localhost/users', {
        method: 'POST',
        body: JSON.stringify({
          role: 'superuser',
        }),
      });
      const app = new RouterWorkers(request);

      let validationError: any = null;

      await app.post(
        '/users',
        validate({
          body: {
            role: { type: 'string', enum: ['user', 'admin', 'moderator'] },
          },
          onError: (errors) => {
            validationError = errors;
          },
        }),
        (req: Req, res: Res) => {
          res.send({ success: true });
        },
      );

      app.resolve();
      expect(validationError).toHaveLength(1);
      expect(validationError[0].code).toBe('invalid_enum');
    });

    test('Deve validar com regex pattern', async () => {
      const request = new Request('http://localhost/users', {
        method: 'POST',
        body: JSON.stringify({
          username: 'user name', // espaços não permitidos
        }),
      });
      const app = new RouterWorkers(request);

      let validationError: any = null;

      await app.post(
        '/users',
        validate({
          body: {
            username: {
              type: 'string',
              pattern: /^[a-z0-9_]+$/,
              message:
                'Username can only contain lowercase letters, numbers and underscores',
            },
          },
          onError: (errors) => {
            validationError = errors;
          },
        }),
        (req: Req, res: Res) => {
          res.send({ success: true });
        },
      );

      app.resolve();
      expect(validationError).toHaveLength(1);
      expect(validationError[0].message).toContain('lowercase');
    });

    test('Deve validar com custom validator', async () => {
      const request = new Request('http://localhost/users', {
        method: 'POST',
        body: JSON.stringify({
          password: 'weak',
        }),
      });
      const app = new RouterWorkers(request);

      let validationError: any = null;

      await app.post(
        '/users',
        validate({
          body: {
            password: {
              type: 'string',
              custom: (value: string) => {
                if (value.length < 8)
                  return 'Password must be at least 8 characters';
                if (!/[A-Z]/.test(value))
                  return 'Password must contain uppercase letter';
                if (!/[0-9]/.test(value)) return 'Password must contain number';
                return true;
              },
            },
          },
          onError: (errors) => {
            validationError = errors;
          },
        }),
        (req: Req, res: Res) => {
          res.send({ success: true });
        },
      );

      app.resolve();
      expect(validationError).toHaveLength(1);
      expect(validationError[0].message).toContain('8 characters');
    });

    test('Deve passar com dados válidos', async () => {
      const request = new Request('http://localhost/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'John Doe',
          email: 'john@example.com',
          age: 25,
          role: 'user',
        }),
      });
      const app = new RouterWorkers(request);

      let wasCalledWithValidData = false;

      await app.post(
        '/users',
        validate({
          body: {
            name: { type: 'string', required: true, minLength: 3 },
            email: { type: 'email', required: true },
            age: { type: 'number', min: 18, max: 120 },
            role: { type: 'string', enum: ['user', 'admin'] },
          },
        }),
        (req: Req, res: Res) => {
          wasCalledWithValidData = true;
          res.send({ success: true });
        },
      );

      app.resolve();
      expect(wasCalledWithValidData).toBe(true);
    });
  });

  describe('Validação de Params', () => {
    test('Deve validar UUID em params', async () => {
      const request = new Request('http://localhost/users/invalid-uuid');
      const app = new RouterWorkers(request);

      let validationError: any = null;

      await app.get(
        '/users/:id',
        validate({
          params: {
            id: { type: 'uuid', required: true },
          },
          onError: (errors) => {
            validationError = errors;
          },
        }),
        (req: Req, res: Res) => {
          res.send({ success: true });
        },
      );

      app.resolve();
      expect(validationError).toHaveLength(1);
      expect(validationError[0].code).toBe('invalid_uuid');
    });

    test('Deve passar com UUID válido', async () => {
      const request = new Request(
        'http://localhost/users/123e4567-e89b-12d3-a456-426614174000',
      );
      const app = new RouterWorkers(request);

      let wasCalledWithValidData = false;

      await app.get(
        '/users/:id',
        validate({
          params: {
            id: { type: 'uuid', required: true },
          },
        }),
        (req: Req, res: Res) => {
          wasCalledWithValidData = true;
          res.send({ success: true });
        },
      );

      app.resolve();
      expect(wasCalledWithValidData).toBe(true);
    });
  });

  describe('Validação de Queries', () => {
    test('Deve validar paginação', async () => {
      const request = new Request('http://localhost/users?page=0&limit=200');
      const app = new RouterWorkers(request);

      let validationError: any = null;

      await app.get(
        '/users',
        validate({
          queries: {
            page: { type: 'number', min: 1 },
            limit: { type: 'number', min: 1, max: 100 },
          },
          onError: (errors) => {
            validationError = errors;
          },
        }),
        (req: Req, res: Res) => {
          res.send({ success: true });
        },
      );

      app.resolve();
      expect(validationError).toHaveLength(2);
    });
  });

  describe('Schemas Pré-definidos', () => {
    test('Schema uuid deve estar disponível', () => {
      expect(schemas.uuid).toBeDefined();
      expect(schemas.uuid.type).toBe('uuid');
    });

    test('Schema email deve estar disponível', () => {
      expect(schemas.email).toBeDefined();
      expect(schemas.email.type).toBe('email');
    });

    test('Schema pagination deve estar disponível', () => {
      expect(schemas.pagination).toBeDefined();
      expect(schemas.pagination.page).toBeDefined();
      expect(schemas.pagination.limit).toBeDefined();
    });

    test('Deve usar o schema de paginação pré-definido', async () => {
      const request = new Request('http://localhost/items?page=abc');
      const app = new RouterWorkers(request);

      let validationError: any = null;

      await app.get(
        '/items',
        validate({
          queries: schemas.pagination,
          onError: (errors) => {
            validationError = errors;
          },
        }),
        (req: Req, res: Res) => {
          res.send({ success: true });
        },
      );

      app.resolve();
      expect(validationError).not.toBeNull();
      expect(validationError[0].field).toBe('page');
      expect(validationError[0].code).toBe('invalid_type');
    });
  });

  describe('Mensagens de Erro', () => {
    test('Deve usar mensagem customizada', async () => {
      const request = new Request('http://localhost/users', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const app = new RouterWorkers(request);

      let validationError: any = null;

      await app.post(
        '/users',
        validate({
          body: {
            name: {
              type: 'string',
              required: true,
              message: 'O nome é obrigatório',
            },
          },
          onError: (errors) => {
            validationError = errors;
          },
        }),
        (req: Req, res: Res) => {
          res.send({ success: true });
        },
      );

      app.resolve();
      expect(validationError[0].message).toBe('O nome é obrigatório');
    });
  });
});
