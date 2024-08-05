export enum Method {
    POST = 'POST',
    GET = 'GET',
    PUT = 'PUT',
    DELETE = 'DELETE'
}

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
    // origin?: {
    //     hostname: string[],
    //     method?: string[]
    // };
    cache?: {
        pathname: string[];
        maxage: string
    }
}

export interface Caches {
    default: {
        delete(request: Request | URL,): Promise<boolean>;
        has(cacheName: string): Promise<boolean>;
        keys(): Promise<string[]>;
        match(request: RequestInfo | URL, options?: MultiCacheQueryOptions): Promise<Response | undefined>;
        put(request: Request | URL, response: Response): Promise<Response | undefined>;
        open(cacheName: string): Promise<Cache>;
    };
}
