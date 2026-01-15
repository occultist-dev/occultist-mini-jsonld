import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {Registry} from '@occultist/occultist';
import {JSONLDContext, JSONLDContextBag} from '../lib/expand.ts';


function makeTestDeps() {
  const registry = new Registry({
    rootIRI: 'https://example.com',
  });

  registry.http.get('/context')
    .public()
    .handle('application/ld+json', JSON.stringify({
      '@id': 'https://example.com/context',
      '@context': {
        'scm': 'https://schema.org/',
      },
    }));

  registry.http.get('/context2')
    .public()
    .handle('application/ld+json', JSON.stringify({
      '@id': 'https://example.com/context2',
      '@context': [
        'https://example.com/context',
        { '@vocab': 'https://schema.occultist.dev/' }
      ],
    }));


  const bag = new JSONLDContextBag({
    fetcher: (url: string, init: RequestInit) => registry.handleRequest(
      new Request(url, init),
    ),
  });

  return { registry, bag };
}


describe('JSONLDContext.fetch()', () => {
  it('Fetches remote contexts', async () => {
    const { bag } = makeTestDeps();
    const ctx = await JSONLDContext.fetch('https://example.com/context', bag);
    
    assert(ctx.types.has('https://schema.org/'));
    assert.equal(ctx.types.get('scm').id, 'https://schema.org/');
  });

  it('Merges deep remote contexts', async () => {
    const { bag } = makeTestDeps();
    const ctx = await JSONLDContext.fetch('https://example.com/context2', bag);
    
    assert(ctx.types.has('https://schema.org/'));
    assert.equal(ctx.types.get('scm').id, 'https://schema.org/');
    assert.equal(ctx.vocab, 'https://schema.occultist.dev/');
  });

  it('Does not cache contexts when not enabled', async () => {
    let hit = 0;
    const { registry } = makeTestDeps();
    const bag = new JSONLDContextBag({
      fetcher: (url: string, init: RequestInit) => {
        hit++;

        return registry.handleRequest(new Request(url, init));
      }
    });
    await JSONLDContext.fetch('https://example.com/context2', bag);
    const ctx = await JSONLDContext.fetch('https://example.com/context2', bag);
    
    assert.equal(hit, 4);
    assert(ctx.types.has('https://schema.org/'));
    assert.equal(ctx.types.get('scm').id, 'https://schema.org/');
    assert.equal(ctx.vocab, 'https://schema.occultist.dev/');
  });

  it('Caches contexts when enabled', async () => {
    let hit = 0;
    const { registry } = makeTestDeps();
    const bag = new JSONLDContextBag({
      cacheMethod: 'cache',
      fetcher: (url: string, init: RequestInit) => {
        hit++;

        return registry.handleRequest(new Request(url, init));
      }
    });
    await JSONLDContext.fetch('https://example.com/context2', bag);
    const ctx = await JSONLDContext.fetch('https://example.com/context2', bag);
    
    assert.equal(hit, 2);
    assert(ctx.types.has('https://schema.org/'));
    assert.equal(ctx.types.get('scm').id, 'https://schema.org/');
    assert.equal(ctx.vocab, 'https://schema.occultist.dev/');
  });

});
