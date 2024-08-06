export interface Req extends Request {
    queries?: any;
    param?: any;
    bodyJson?: any;
}
export interface Res {
    send: (data: any, config?: ResponseInit) => void;
    redirect: (url: string | URL, status?: number) => void;
}
export type Args = [pathname: string, ...middlewares: Function[], callback: Function];
export type ConfigWorker = {
    cache?: {
        pathname: string[];
        maxage: string;
    };
};
export interface Caches {
    default: {
        delete(request: Request | URL): Promise<boolean>;
        has(cacheName: string): Promise<boolean>;
        keys(): Promise<string[]>;
        match(request: RequestInfo | URL, options?: MultiCacheQueryOptions): Promise<Response | undefined>;
        put(request: Request | URL, response: Response): Promise<Response | undefined>;
        open(cacheName: string): Promise<Cache>;
    };
}
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
