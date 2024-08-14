import { Args, Caches, ConfigWorker, Req, Res } from "../types/index";
import { getQueryInPathName } from "./utils/getQueries";

declare const caches: Caches;

export class RouterWorkers {
    private method: string;
    private url: URL;
    private incrementRoute = [];
    private config: ConfigWorker;
    private resolved: boolean = false;
    public req: Req;
    public response: Response;
    public res: Res = {
        send: (data: Object | string, config?: ResponseInit) => {
            if(typeof data == "object"){
                this.response = Response.json(data, config);
            }else{
                this.response = new Response(data, config);
            }
            this.resolved = true;
        },
        redirect: (url: string | URL, status?: number) => {
            this.response = Response.redirect(url, status);
            this.resolved = true;
        }
    };

    constructor(request: Request, config?: ConfigWorker){
        this.url = new URL(request.url);
        this.method = request.method;
        this.config = config;
        this.req = new Request(request);
    }

    async use(...args: Function[]){
        for (let i = 0; i < args.length; i++) {
            let middleware = args[i];
            if(this.resolved) return;
            await middleware(this.req, this.res);
        }
        return;
    }

    async get(...args: Args) {
        if (!this.resolved && this.method == 'GET' && this.isPathName(args[0])) {
            this.req['queries'] = getQueryInPathName(this.url.search);
            await this.foreachMiddleware(args);
            if(this.resolved) return;
            let cbResult = args[args.length-1] as Function;
            let isPathNameInCache: boolean = false;
     
            for (let pathname of this.config?.cache?.pathname || []){
                if (pathname.includes(',') && pathname.split(',')[0] == args[0]) {
                    let pathNameAndTime = pathname.split(',');
                    isPathNameInCache = pathNameAndTime[0] == args[0] ? true : false;
                    this.config.cache.maxage = pathNameAndTime[1];
                    break;
                }else if(pathname == args[0]){
                    isPathNameInCache = true;
                    break;
                }
            };
            return isPathNameInCache ? await this.setCache(cbResult) : cbResult(this.req, this.res);  
            
        }else{
            this.incrementRoute.push(args[0]);
        }
    }

    async post(...args: Args){
        if(!this.resolved && this.method == 'POST' && this.isPathName(args[0])){
            this.req.bodyJson = await this.req.json();
            await this.foreachMiddleware(args);
            if(this.resolved) return;
            let cbResult = args[args.length-1] as Function;
            return cbResult(this.req, this.res);
        } else {
            this.incrementRoute.push(args[0]);
        }
    }

    async put(...args: Args){
        if(!this.resolved && this.method == 'PUT' && this.isPathName(args[0])){
            this.req.bodyJson = await this.req.json().catch(e => e.message);
            await this.foreachMiddleware(args);
            if(this.resolved) return;
            await this.removeCache(args[0]);
            let cbResult = args[args.length-1] as Function;
            return cbResult(this.req, this.res);
        } else {
            this.incrementRoute.push(args[0]);
        }
    }

    async delete(...args: Args){
        if(!this.resolved && this.method == 'DELETE' && this.isPathName(args[0])){
            await this.foreachMiddleware(args);
            if(this.resolved) return;
            await this.removeCache(args[0]);
            let cbResult = args[args.length-1] as Function;
            return cbResult(this.req, this.res);
        } else {
            this.incrementRoute.push(args[0]);
        }
    }

    isPathName(path: string): boolean{
        let fullPath = this.url.pathname.split('/');
        if(fullPath.length > 2 && path?.includes(':') && path.includes(fullPath[1])){
            let key = path.split(':')[1];
            this.req['param'] = {[key]: fullPath[2]};
            if('/'+fullPath[1]+'/:'+key == path) return true;
        }else if(this.url.pathname == path){ 
            return true;
        }else{
            return false;
        }
    }

    async foreachMiddleware(args: any[]){
        for (let i = 1; i < args.length-1; i++) {
            let middleware = args[i];
            await middleware(this.req, this.res);
        }
        return;
    }

    async setCache(callback: Function) {
        const cache = caches.default;
        const cacheKey = new Request(this.req.url, {method: 'GET'});
		let response = await cache.match(cacheKey);
        if (!response) {
            await callback(this.req, this.res);
            this.response.headers.append('Cache-Control', 's-maxage='+this.config.cache.maxage);
            await cache.put(cacheKey, this.response.clone());
            return;
        }
        return this.res.send(await response.json());
    }

    async removeCache(pathname: string){
        if(this.config?.cache?.pathname.length > 0 && this.config?.cache?.pathname.includes(pathname)){
            const cacheKey = new Request(this.req.url, {method: 'GET'});
            await caches.default.delete(cacheKey);
        }
        return;
    }

    resolve():Response{
        if(!this.response){
            this.incrementRoute.forEach((pathname: string) => {
                if(!this.isPathName(pathname)) return this.res.send('Not Found: '+ this.url.pathname);
            });
        }
        return this.response as Response;
    }
}

// Middlewares
// export function expurgCache(req: Req, res: Res){
//     let cacheKey = new Request(req.url, {method: 'GET'});
//     caches.default.delete(cacheKey);
// }