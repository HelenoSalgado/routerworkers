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

export interface Res extends Response {
    sendJson?: Function;  
}