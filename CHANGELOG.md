# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [0.3.0] - 2024-10-18

### 🎉 Adicionado
- **Response Helpers**: 14 métodos semânticos para respostas HTTP
  - Success: `ok()`, `created()`, `accepted()`, `noContent()`
  - Client Errors: `badRequest()`, `unauthorized()`, `forbidden()`, `notFound()`, `conflict()`, `unprocessable()`
  - Server Errors: `serverError()`
  - Custom: `json()`, `html()`, `text()`
- **Route Groups**: Sistema completo de agrupamento de rotas
  - Prefixos compartilhados (`/api/v1`)
  - Middlewares de grupo
  - Aninhamento ilimitado
  - Suporte a todos métodos HTTP
- **CORS Middleware**: Middleware CORS completo
  - Configuração flexível de origins (string, array, function)
  - Preflight automático (OPTIONS)
  - Presets: `corsDevMode()` e `corsProduction()`
  - Headers customizados e credenciais
- 21 novos testes (total: 51 testes)
- Exemplos completos na pasta `examples/`
- Documentação detalhada (FASE3_RESUMO.md)

### 🔧 Melhorado
- Interface `Res` expandida com 14 novos métodos
- Interface `ConfigWorker` com opções CORS
- Tipos TypeScript mais precisos
- README.md completamente reescrito

### 📦 Estatísticas
- Bundle: 29KB (vs 20KB v0.2.0)
- Testes: 51/51 passando (100%)
- Zero dependências de runtime

---

## [0.2.0] - 2024-10-18

### 🎉 Adicionado
- **Validador Built-in**: Sistema completo de validação sem dependências
  - 8 tipos suportados: string, number, boolean, email, url, uuid, date, array
  - Validação de body, params e queries
  - Schemas pré-definidos (uuid, email, url, pagination, etc)
  - Mensagens de erro customizáveis
  - Modo strict e transformações
- Middleware `validate()` para validação declarativa
- 16 testes de validação
- Exemplos de uso (examples/fase2a-example.ts)
- Documentação detalhada (FASE2A_RESUMO.md)

### 🔧 Melhorado
- Sistema de tipos mais robusto
- Melhor integração com TypeScript
- Performance otimizada

### 📦 Estatísticas
- Bundle: 20KB (vs 12KB v0.1.0)
- Testes: 30/30 passando (100%)
- Zero dependências

---

## [0.1.0] - 2024-10-17

### 🎉 Adicionado
- **Rotas Aninhadas**: Suporte completo a rotas com múltiplos parâmetros
  - `/users/:userId/posts/:postId`
  - Parser de rotas otimizado com regex
  - Cache de parsers para performance
- **Tratamento de Erros**: Sistema robusto de error handling
  - `app.onError()` para handler customizado
  - `app.notFound()` para 404 customizado
  - Try-catch em todos middlewares e handlers
- **Melhorias de Tipagem**:
  - `req.params` (plural) como padrão
  - `req.param` mantido para compatibilidade
  - Tipos mais precisos e intuitivos
- 14 testes cobrindo novas features
- Documentação expandida (FASE1_RESUMO_FINAL.md)

### 🔧 Melhorado
- Sistema de roteamento mais robusto
- Melhor performance com cache de parsers
- Código mais limpo e organizado

### 📦 Estatísticas
- Bundle: 12KB (vs 2KB v0.0.9)
- Testes: 14/14 passando (100%)

---

## [0.0.9] - 2024-10-15

### 🎉 Release Inicial
- Roteamento básico (GET, POST, PUT, DELETE)
- Middlewares globais e por rota
- Cache API integrado
- Suporte a parâmetros simples (`:id`)
- Query strings
- Body JSON
- TypeScript support
- 2KB bundle

### Funcionalidades
- `app.get()`, `app.post()`, `app.put()`, `app.delete()`
- `app.use()` para middlewares globais
- `res.send()` e `res.redirect()`
- `req.param`, `req.queries`, `req.bodyJson`
- Configuração de cache

---

## Roadmap

### [0.4.0] - Planejado
- [ ] Rate limiting
- [ ] Compression (gzip/brotli)
- [ ] Static files serving
- [ ] WebSocket support
- [ ] Session management
- [ ] Request body parsing (FormData, multipart)

### [0.5.0] - Futuro
- [ ] Plugin system
- [ ] Zod integration (opcional)
- [ ] OpenAPI/Swagger generation
- [ ] Metrics and monitoring
- [ ] Hot reload development

---

## Como Contribuir

Veja [CONTRIBUTING.md](./CONTRIBUTING.md) para detalhes sobre como contribuir.

## Licença

MIT © [Heleno Salgado](https://github.com/HelenoSalgado)
