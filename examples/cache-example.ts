/**
 * Exemplo de Cache com Versionamento Automático
 * RouterWorkers v0.3.0+
 */

import { RouterWorkers } from '../src/index';
import type { Req, Res, ConfigWorker } from '../types/index';

// A interface Env é necessária para que o TypeScript reconheça 
// as variáveis de ambiente injetadas pelo Cloudflare, como CF_VERSION_METADATA.
interface Env {
    CF_VERSION_METADATA: {
        id: string;
        timestamp: string;
        tag: string;
    };
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {

        // 1. Obtenha o ID único da implantação a partir das variáveis de ambiente.
        // Este valor muda automaticamente a cada `wrangler deploy`.
        const deploymentId = env.CF_VERSION_METADATA.id;

        // 2. Configure o RouterWorkers para usar o cache.
        // A propriedade 'version' agora é o ID dinâmico da implantação.
        const config: ConfigWorker = {
            cache: {
                pathname: ['/data'], // A rota que queremos cachear
                maxage: '3600',      // Tempo de vida do cache em segundos (1 hora)
                version: deploymentId // Chave de versionamento automático
            }
        };

        const app = new RouterWorkers(request, config);

        /**
         * Esta rota será cacheada. 
         * Na primeira vez que for acessada, o código abaixo será executado.
         * Nas próximas requisições (dentro da mesma implantação), a resposta virá direto do cache.
         * Quando um novo deploy for feito, o `deploymentId` mudará, o cache antigo será ignorado,
         * e esta função será executada novamente na primeira requisição.
         */
        await app.get('/data', (req: Req, res: Res) => {
            console.log('Executando a lógica da rota /data (não veio do cache)');
            const responseData = {
                message: 'Estes são dados frescos, servidos diretamente pela função.',
                timestamp: new Date().toISOString(),
                deploymentId: deploymentId
            };
            res.ok(responseData);
        });

        // Rota não cacheada
        await app.get('/', (req: Req, res: Res) => {
            res.html(`
                <h1>Exemplo de Cache Automático</h1>
                <p>Acesse <a href="/data">/data</a> para ver a mágica do cache.</p>
                <p>ID da Implantação Atual: <code>${deploymentId}</code></p>
            `);
        });

        return app.resolve();
    }
};
