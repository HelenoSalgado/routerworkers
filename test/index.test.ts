import api from './worker.test';

describe('\n GET - Recebe objecto Json: http://localhost/posts/workers-router', () => {
    let request = new Request('http://localhost/posts/workers-router');
    test("Result GET equal { project: 'Router Workers' }", async() => {
      let data = await api.fetch(request, undefined, undefined);
      expect(await data.json()).toEqual({project: 'Router to Workers'});
    });
});

describe('\n GET - Recebe queries de consulta: http://localhost/posts?slug=first-post&comments=true&likes=true', () => {
  let request = new Request('http://localhost/posts?slug=first-post&comments=true&likes=true');
  test("Result GET equal {\"comments\":\"true\", \"likes\":\"true\", \"slug\":\"first-post\" }", async() => {
    let data = await api.fetch(request, undefined, undefined);
    expect(await data.json()).toEqual({  
      "comments": "true", 
      "likes": "true",
      "slug": "first-post"
    });
  });
});


