import { RouterWorkers } from '../src/index';
import type { Req, Res } from '../src/index';

export default {
  async fetch(request: Request): Promise<Response> {
    const app = new RouterWorkers(request);

    await app.get('/posts/workers-router', (req: Req, res: Res) => {
      res.json({ project: 'Router to Workers' });
    });

    await app.get('/posts', (req: Req, res: Res) => {
      res.json(req.queries);
    });

    return app.resolve();
  },
};
