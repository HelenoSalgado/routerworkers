import { Req, Res } from "../src/types";

export class RouterWorkers {
    private method: string;
    private url: URL;
    public req: Req;
    public res = Response;

    constructor(request: Request){
        this.url = new URL(request.url);
        this.method = request.method;
        this.req = new Request(request);
    }

    async get(...args: any) {
        //console.log(this.req)
        let path: string = args[0];
        let pathname = this.getFullPath(path);
        if (path == pathname && this.method == 'GET') {
            await this.foreachMiddleware(args);
            return this.res = args[args.length-1](this.req, this.res);
        }
    }

    async post(...args: any){
        let path: string = args[0];
        if(path == this.url.pathname && this.method == 'POST'){
            this.req.bodyJson = await this.req.json();
            await this.foreachMiddleware(args);
            return this.res = args[args.length-1](this.req, this.res);
        } else {
            return
        }
    }

    async put(...args: any){
        let path: string = args[0];
        let pathname = this.getFullPath(path);
        if(path == pathname && this.method == 'PUT'){
            this.req.bodyJson = await this.req.json().catch(e => e.message);
            await this.foreachMiddleware(args);
            return this.res = args[args.length-1](this.req, this.res);
        } else {
            return;
        }
    }

    async delete(...args: any){
        let path: string = args[0];
        let pathname = this.getFullPath(path);
        if(path == pathname && this.method == 'DELETE'){
            await this.foreachMiddleware(args);
            return this.res = args[args.length-1](this.req, this.res);
        } else {
            return
        }
    }

    async resolve(){
        return this.res;
    }

    getFullPath(path: string){
        let fullPath = this.url.pathname.split('/');
        if(fullPath.length > 2 && path.includes(':') && path.includes(fullPath[1])){
            let key = path.split(':')[1];
            this.req['param'] = {[key]: fullPath[2]};
            return path
        }
        return this.url.pathname;
    }

    async foreachMiddleware(args: IArguments){
        for (let i = 1; i < args.length-1; i++) {
            let middleware = args[i];
            this.req = await middleware(this.req);
        }
        return;
    }
}