'use strict';

class RouterWorkers {
    method;
    url;
    req;
    res = Response;
    constructor(request) {
        this.url = new URL(request.url);
        this.method = request.method;
        this.req = new Request(request);
    }
    async get(...args) {
        //console.log(this.req)
        let path = args[0];
        let pathname = this.getFullPath(path);
        if (path == pathname && this.method == 'GET') {
            await this.foreachMiddleware(args);
            return this.res = args[args.length - 1](this.req, this.res);
        }
    }
    async post(...args) {
        let path = args[0];
        if (path == this.url.pathname && this.method == 'POST') {
            this.req.bodyJson = await this.req.json();
            await this.foreachMiddleware(args);
            return this.res = args[args.length - 1](this.req, this.res);
        }
        else {
            return;
        }
    }
    async put(...args) {
        let path = args[0];
        let pathname = this.getFullPath(path);
        if (path == pathname && this.method == 'PUT') {
            this.req.bodyJson = await this.req.json().catch(e => e.message);
            await this.foreachMiddleware(args);
            return this.res = args[args.length - 1](this.req, this.res);
        }
        else {
            return;
        }
    }
    async delete(...args) {
        let path = args[0];
        let pathname = this.getFullPath(path);
        if (path == pathname && this.method == 'DELETE') {
            await this.foreachMiddleware(args);
            return this.res = args[args.length - 1](this.req, this.res);
        }
        else {
            return;
        }
    }
    async resolve() {
        return this.res;
    }
    getFullPath(path) {
        let fullPath = this.url.pathname.split('/');
        if (fullPath.length > 2 && path.includes(':') && path.includes(fullPath[1])) {
            let key = path.split(':')[1];
            this.req['param'] = { [key]: fullPath[2] };
            return path;
        }
        return this.url.pathname;
    }
    async foreachMiddleware(args) {
        for (let i = 1; i < args.length - 1; i++) {
            let middleware = args[i];
            this.req = await middleware(this.req);
        }
        return;
    }
}

exports.RouterWorkers = RouterWorkers;
