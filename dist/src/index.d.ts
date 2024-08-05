import { Args, ConfigWorker, Req, Res } from "../types/index";
export declare class RouterWorkers {
    private method;
    private url;
    private config;
    private resolved;
    req: Req;
    response: Response;
    res: Res;
    constructor(request: Request, config?: ConfigWorker);
    use(...args: Function[]): Promise<void>;
    get(...args: Args): Promise<any>;
    post(...args: Args): Promise<any>;
    put(...args: Args): Promise<any>;
    delete(...args: Args): Promise<any>;
    resolve(): Response;
    isPathName(path: string): boolean;
    getQueryInPathName(): {};
    foreachMiddleware(args: any[]): Promise<void>;
    setCache(callback: Function): Promise<void>;
    removeCache(pathname: string): Promise<void>;
}
