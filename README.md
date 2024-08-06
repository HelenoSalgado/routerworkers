# Router Workers

Um roteador simples para Cloudflare Workers. Suporta middlewares, cache e injeta alguns dados transformados ao objeto Request.

## Como usar

Você deverá instanciar o objeto de roteamento passando para o construtor o objeto Request do seu worker e, opcionalmente, uma configuração para cache:

```
const app = RouterWorkers(Request, {
    cache: {
        pathname: ['/comments'],
        maxage: '87000'
    }
});
```
Dessa forma a rota de comentários será armazenada em cache por 24 horas aproximadamente, exceto se uma requisição `POST`, `PUT` ou `DELETE` for aceita para essa mesma rota, então o cache será removido imediatamente e atualizado na próxima solicitação GET.

```
await app.get('/comments', async(req: Req, res: Res) => {
    const comments = await comments.getAll();
    res.send(comments);
});

return app.resolve();
```
**Obs:** `await` é necessário para que o roteador espere pela resposta da rota alvo, caso contrário ele retornaria uma resposta não resolvida.

Opcionalmente você também poderia passar um objeto de status na resposta, como em:

```
res.send('Nenhum comentário encontrado', {
    status: 404
});
```
* O retorno com `app.resolve()` sempre deverá ser o último método a ser chamado, implicitamente ele está retornando o objeto **Response**. 

* Há dois formatos de resposta possíveis: `text/plain` e `application/json`. Logo, qualquer outro formato irá incorrer em erro.

## Middleware Geral

Se você tem um middleware geral ou parcial, poderá usá-lo sempre antes das rotas alvos, com `app.use()`.

```
app.use(allowOrigin);
```
A função de middleware receberá um objeto **req** e **res**:

```
export async function allowOrigin(req: Req, res: Res){
    if(req.headers.get('origin') != 'domain.com'){
        res.send('Origem não permitida', { status: 403 });
    }
    return;
};
```
*Você também poderá usar `res.redirect()` para redirecionar a solicitação*.

**Obs:** Toda vez que um middleware invocar `res.send()` ou `res.redirect()` a solicitação será resolvida imeditamente e retornará a resposta. Não fazer nada ou simplesmente retornar, fará com que a próxima função da pilha seja executada.

## Middleware de rota

```
await app.delete('/comments/:id', middlewareAuth, async(req: Req, res: Res) => {
    await deleteComment(req.param.id);
    res.send('', { status: 204 });
});
```
Por padrão o objeto Request do worker é imutável, então o *Router Workers* instancia um Request mutável, assim é perfeitamente possível customizar *alterar e injetar novas propriedades* ao `req` objeto em seus middlewares. Existem pelo menos três propriedades predefinidas:

* param;
* queries;
* bodyJson. 

Dessa forma é possível acessar `req.param.id` como na rota acima.

A primeira propriedade está disponível para todos os métodos http, já a queries somente para o verbo `GET`, e a última recebe o valor da promessa resolvida de `await request.json()` do objeto Request para solicitações `PUT` e `POST`.

## Cache API

O Router Workers aproveita a API de cache do Cloudfare Workers e armazena em cache todas as respostas de rotas que forem incluídas no array de `pathname` na inicialização do roteador. A propriedade `maxage` deve receber uma string contendo o tempo em segundos que o cache ficará ativo:

```
const app = RouterWorkers(Request, {
    cache: {
        pathname: ['/comments', '/likes/:slug'],
        maxage: '87000'
    }
});
```
* A chave para armazenar, buscar ou deletar o cache é sempre a URL (caminho completo) da solicitação.
* O cache só responde à solicitações do tipo `GET` e sempre que um recurso for criado ou modificado, o cache correspondente ao `pathname` será eliminado.

## Limitações

* Todos os dados resgatados da URL (parâmetro e queries) são do tipo String;
* Não existe suporte para rotas aninhadas, ex: `/user/profile/:id`;
* CORS mecânismo não está presente.

O `routerworkers` não consegue fazer nada além do que aqui foi descrito. Talvez melhore com o tempo. Visite o repositório no github e ajude no que puder. Obrigado. 






