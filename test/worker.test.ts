import { RouterWorkers } from "../src/index";
import { Req, Res } from '../dist/index'

export default {

  async fetch(request: Request, env: any, ctx: any){

    const app = new RouterWorkers(request);

    await app.get('/posts/:slug', async(req: Req, res: Res) => {
      res.send({project: 'Router to Workers'});
    });

    await app.get('/posts', async(req: Req, res: Res) => {
      res.send(req.queries);
    });

    return app.resolve();
     
  }

}

