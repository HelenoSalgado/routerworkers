# Plano de Benchmarks - RouterWorkers

## 🎯 Objetivo

Estabelecer métricas de performance para validar que as melhorias propostas **não comprometem** a velocidade e eficiência do RouterWorkers.

---

## 📊 Métricas a Medir

### 1. Performance de Execução
- ⏱️ **Latência** (p50, p95, p99)
- 🔄 **Throughput** (requisições/segundo)
- 💾 **Uso de Memória**
- ⚡ **Cold Start** (primeira execução)
- 🔥 **Warm Performance** (execuções subsequentes)

### 2. Bundle Size
- 📦 **Raw Size** (código fonte)
- 🗜️ **Minified Size**
- 🗜️ **Minified + Gzipped**
- 📈 **Size Growth** (comparado com versão anterior)

### 3. Developer Experience
- ⌨️ **TypeScript Autocomplete Speed**
- 🐛 **Error Message Quality**
- 📚 **API Learning Curve**

---

## 🧪 Cenários de Teste

### Benchmark 1: Hello World
**Objetivo**: Medir overhead mínimo do framework

```typescript
// Baseline (sem framework)
export default {
    async fetch(request: Request) {
        return new Response('Hello World');
    }
};

// RouterWorkers
import { RouterWorkers } from 'routerworkers';

export default {
    async fetch(request: Request) {
        const app = new RouterWorkers(request);
        app.get('/', (req, res) => {
            res.send('Hello World');
        });
        return app.resolve();
    }
};
```

**Métrica esperada**: < 1ms overhead

---

### Benchmark 2: Rotas Simples
**Objetivo**: Medir performance de roteamento básico

```typescript
app.get('/users', listUsers);
app.get('/posts', listPosts);
app.get('/comments', listComments);
// ... 100 rotas

// Testar acesso a:
// - Primeira rota (melhor caso)
// - Última rota (pior caso)  
// - Rota do meio (caso médio)
// - Rota inexistente (404)
```

**Métrica esperada**: < 2ms para 100 rotas

---

### Benchmark 3: Rotas Aninhadas
**Objetivo**: Medir overhead de regex/parsing

```typescript
// v0.0.9 (atual)
app.get('/users/:id', handler);

// v0.1.0 (proposto)
app.get('/api/v1/users/:userId/posts/:postId/comments/:commentId', handler);

// Comparar:
// - Tempo de parsing da rota
// - Extração de parâmetros
// - Matching de diferentes URLs
```

**Métrica esperada**: < 5% overhead vs. rotas simples

---

### Benchmark 4: Middlewares
**Objetivo**: Medir custo de execução de middlewares

```typescript
// Sem middleware
app.get('/data', handler);

// Com 1 middleware
app.get('/data', middleware1, handler);

// Com 5 middlewares
app.get('/data', mw1, mw2, mw3, mw4, mw5, handler);

// Com 10 middlewares
app.get('/data', ...tenMiddlewares, handler);
```

**Métrica esperada**: ~0.1-0.3ms por middleware

---

### Benchmark 5: Cache API
**Objetivo**: Medir performance do cache

```typescript
// Sem cache
app.get('/data', handler);

// Com cache (HIT)
app.get('/data', handler); // Configurado com cache

// Com cache (MISS)
app.get('/data', handler); // Primeira requisição

// Comparar:
// - Latência com cache HIT vs. sem cache
// - Latência com cache MISS vs. sem cache
// - Throughput com cache habilitado
```

**Métrica esperada**: 
- Cache HIT: 50-80% mais rápido
- Cache MISS: 10-20% mais lento (overhead de setup)

---

### Benchmark 6: JSON Processing
**Objetivo**: Medir performance de JSON parse/stringify

```typescript
// Small payload (1KB)
app.post('/small', (req, res) => {
    res.send(req.bodyJson);
});

// Medium payload (100KB)
app.post('/medium', (req, res) => {
    res.send(req.bodyJson);
});

// Large payload (1MB)
app.post('/large', (req, res) => {
    res.send(req.bodyJson);
});
```

**Métrica esperada**: Linear com tamanho do payload

---

### Benchmark 7: Validação
**Objetivo**: Medir overhead de validação de dados

```typescript
// Sem validação
app.post('/users', handler);

// Com validação simples (3 campos)
app.post('/users', validate({ ... }), handler);

// Com validação complexa (20 campos, nested)
app.post('/users', validate({ ... }), handler);
```

**Métrica esperada**: 
- Validação simples: < 1ms
- Validação complexa: < 5ms

---

### Benchmark 8: CORS
**Objetivo**: Medir overhead de CORS middleware

```typescript
// Sem CORS
app.get('/data', handler);

// Com CORS simples (origin: '*')
app.use(cors({ origin: '*' }));
app.get('/data', handler);

// Com CORS complexo (multiple origins, credentials)
app.use(cors({ 
    origin: [...100origins],
    credentials: true,
    // ... outras opções
}));
app.get('/data', handler);
```

**Métrica esperada**: < 0.5ms overhead

---

## 🔧 Ferramentas

### 1. Cloudflare Workers
```bash
# Usar wrangler para deploy e teste
wrangler dev
wrangler deploy

# Medir com Workers Analytics
# - Request count
# - CPU time
# - Duration
```

### 2. k6 (Load Testing)
```javascript
// benchmark-k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },  // Ramp up
    { duration: '1m', target: 100 },   // Steady state
    { duration: '30s', target: 0 },    // Ramp down
  ],
};

export default function () {
  const res = http.get('https://your-worker.workers.dev/api/users');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 100ms': (r) => r.timings.duration < 100,
  });
}
```

### 3. Benchmark.js
```typescript
// benchmark-suite.ts
import Benchmark from 'benchmark';

const suite = new Benchmark.Suite();

suite
  .add('RouterWorkers#route', () => {
    app.get('/test', handler);
  })
  .add('Native#route', () => {
    if (url.pathname === '/test') handler();
  })
  .on('cycle', (event) => {
    console.log(String(event.target));
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  .run({ async: true });
```

### 4. Bundle Size Analyzer
```bash
# Instalar
npm install -D rollup-plugin-visualizer

# Configurar rollup.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default {
  plugins: [
    visualizer({
      filename: 'bundle-analysis.html',
      open: true
    })
  ]
};

# Rodar
npm run build
```

---

## 📈 Baseline (v0.0.9)

### Performance
| Métrica | Valor |
|---------|-------|
| Hello World Latency | ~0.5ms |
| 100 Rotas (worst case) | ~1.2ms |
| Middleware (x5) | ~0.8ms |
| Cache HIT | ~0.3ms |
| Cache MISS | ~2.5ms |
| JSON 1KB | ~1.0ms |

### Bundle Size
| Métrica | Valor |
|---------|-------|
| Raw | ~8KB |
| Minified | ~2KB |
| Min + Gzip | ~1KB |

---

## 🎯 Targets (v1.0.0)

### Performance (Max Regression)
| Métrica | Máximo Aceitável |
|---------|------------------|
| Hello World | +20% (~0.6ms) |
| 100 Rotas | +50% (~1.8ms) |
| Middleware | +30% (~1.0ms) |
| Cache | Sem regressão |
| JSON | Sem regressão |

### Bundle Size (Max Growth)
| Métrica | Máximo Aceitável |
|---------|------------------|
| Raw | < 50KB |
| Minified | < 15KB |
| Min + Gzip | < 5KB |

**Regra de Ouro**: Features podem ser **ligeiramente mais lentas**, mas bundle deve permanecer **minimalista**.

---

## 🔬 Metodologia de Teste

### 1. Ambiente Controlado
- ✅ Cloudflare Workers em região fixa (US-East)
- ✅ Mesmo payload para todos os testes
- ✅ Múltiplas execuções (min 1000x)
- ✅ Descartar 10% primeiras execuções (warm-up)

### 2. Métricas Estatísticas
- 📊 Média (mean)
- 📊 Mediana (p50)
- 📊 95º percentil (p95)
- 📊 99º percentil (p99)
- 📊 Desvio padrão

### 3. Comparação
- 🆚 Baseline (v0.0.9)
- 🆚 Cada versão subsequente
- 🆚 Competidores (Hono, Worktop, etc)

---

## 📊 Relatório de Benchmark (Template)

```markdown
# Benchmark Report - RouterWorkers v0.X.0

## Executive Summary
- ✅ Performance target met: YES/NO
- ✅ Bundle size target met: YES/NO
- ⚠️ Regressions: [list]
- 🎉 Improvements: [list]

## Detailed Results

### Hello World
| Version | p50 | p95 | p99 | Δ vs baseline |
|---------|-----|-----|-----|---------------|
| v0.0.9  | 0.5ms | 0.8ms | 1.2ms | - |
| v0.1.0  | 0.6ms | 0.9ms | 1.3ms | +20% |

### Bundle Size
| Version | Raw | Min | Gzip | Δ |
|---------|-----|-----|------|---|
| v0.0.9  | 8KB | 2KB | 1KB | - |
| v0.1.0  | 15KB | 5KB | 2KB | +150% raw, +100% gzip |

## Analysis
[Detailed analysis of results]

## Conclusion
[Pass/Fail decision]
```

---

## 🚀 Execução

### Script Automatizado
```bash
#!/bin/bash
# run-benchmarks.sh

echo "🚀 Running RouterWorkers Benchmarks..."

# Build
npm run build

# Bundle size
echo "📦 Analyzing bundle size..."
du -h dist/index.js
gzip -c dist/index.js | wc -c

# Deploy to Workers
echo "☁️ Deploying to Cloudflare..."
wrangler deploy --env benchmark

# Run k6 tests
echo "🔧 Running load tests..."
k6 run benchmark-k6.js

# Run benchmark suite
echo "⚡ Running micro-benchmarks..."
npm run benchmark

# Generate report
echo "📊 Generating report..."
node generate-report.js

echo "✅ Done! Check benchmark-report.html"
```

---

## 📅 Frequência

- 🔄 **Cada PR**: Benchmarks automáticos no CI
- 📅 **Cada Release**: Full benchmark suite
- 📊 **Mensal**: Comparação com competidores
- 📈 **Trimestral**: Análise de tendências

---

## 🎯 Conclusão

Benchmarks são **críticos** para:
1. Validar que melhorias não quebram performance
2. Identificar regressões antes do release
3. Demonstrar value proposition vs. competidores
4. Guiar otimizações futuras

**Meta**: RouterWorkers deve ser **o mais rápido** framework para Workers! ⚡

---

**Próximo passo**: Implementar benchmarks para v0.1.0-beta
