import api from './worker.test';

describe('GET - Recebe Objecto Json', () => {
    let request = new Request('http://localhost/posts/workers-router/');
    test("Result GET equal { project: 'Router Workers' }", async() => {
      let data = await api.fetch(request, undefined, undefined);
      expect(await data.json()).toEqual({project: 'Router to Workers'});
    });
});


