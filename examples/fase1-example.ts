/**
 * Exemplos de uso das melhorias da Fase 1
 * RouterWorkers v0.1.0
 */

import { RouterWorkers } from '../src/index';
import { Req, Res } from '../types/index';

// ============================================================================
// 1. ROTAS ANINHADAS - Agora suportado! 🎉
// ============================================================================

export default {
    async fetch(request: Request, env: any, ctx: any): Promise<Response> {
        const app = new RouterWorkers(request);

        // Rota simples (como antes)
        await app.get('/users', (req: Req, res: Res) => {
            res.send({ users: [] });
        });

        // ✨ NOVO: Rota com um parâmetro
        await app.get('/users/:id', (req: Req, res: Res) => {
            const userId = req.params?.id; // TypeScript sabe que é string | undefined
            res.send({ userId, user: { id: userId, name: 'John' } });
        });

        // ✨ NOVO: Rota aninhada com múltiplos parâmetros
        await app.get('/api/users/:userId/posts/:postId', (req: Req, res: Res) => {
            const { userId, postId } = req.params!;
            res.send({ 
                userId, 
                postId,
                post: { id: postId, authorId: userId, title: 'My Post' }
            });
        });

        // ✨ NOVO: Rota profundamente aninhada
        await app.get('/api/v1/users/:userId/posts/:postId/comments/:commentId', (req: Req, res: Res) => {
            const { userId, postId, commentId } = req.params!;
            res.send({ 
                userId, 
                postId, 
                commentId,
                comment: { id: commentId, postId, text: 'Great post!' }
            });
        });

        // Backward compatibility: req.param ainda funciona
        await app.get('/legacy/:id', (req: Req, res: Res) => {
            const id = req.param?.id; // Ainda funciona!
            res.send({ id });
        });

        return app.resolve();
    }
};

// ============================================================================
// 2. TRATAMENTO DE ERROS - Robusto e flexível! 🛡️
// ============================================================================

export const errorHandlingExample = {
    async fetch(request: Request, env: any, ctx: any): Promise<Response> {
        const app = new RouterWorkers(request);

        // ✨ NOVO: Handler global de erros
        app.onError((error, req, res) => {
            console.error('[ERROR]', error);
            
            // Personalizar resposta de erro
            res.send({
                error: error.message,
                timestamp: new Date().toISOString(),
                path: req.url
            }, { status: error.statusCode || 500 });
        });

        // ✨ NOVO: Handler customizado de 404
        app.notFound((req, res) => {
            res.send({
                error: 'Rota não encontrada',
                path: req.url,
                suggestion: 'Verifique a documentação da API'
            }, { status: 404 });
        });

        // Rota que pode lançar erro
        await app.get('/users/:id', async (req: Req, res: Res) => {
            const user = await findUser(req.params?.id);
            
            if (!user) {
                // Erro será capturado pelo handler global
                throw new Error('Usuário não encontrado');
            }
            
            res.send({ user });
        });

        // Erro em middleware será capturado automaticamente
        await app.get('/protected', 
            async (req: Req, res: Res) => {
                if (!req.headers.get('authorization')) {
                    throw new Error('Não autorizado');
                }
            },
            (req: Req, res: Res) => {
                res.send({ data: 'sensitive' });
            }
        );

        return app.resolve();
    }
};

// Helper function (simulada)
async function findUser(id: string | undefined): Promise<any> {
    return id === '123' ? { id, name: 'John' } : null;
}
