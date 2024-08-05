import { RouterWorkers } from "../src/index";
import { Req, Res } from '../dist/types/index'

export default {

  async fetch(request: Request, env: any, ctx: any){

    const app = new RouterWorkers(request);

    await app.get('/posts/:slug', async(req: Req, res: Res) => {
      res.send({project: 'Router to Workers'}, {
        status: 200
      });
    });

    return app.resolve();
     
  }

}

