import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {JSONLDContextBag, type IRIObject} from '../lib/expand.ts';


function makeFetcher(docs: IRIObject[]): typeof fetch {
  const map = docs.reduce((acc, doc) => ({
    ...acc,
    [doc['@id']]: doc,
  }), {}); 

  return async (url: string) => {
    return new Response(
      JSON.stringify(map[url]),
      { headers: { 'Content-Type': 'application/ld+json' } },
    );
  };
}


describe('JSONLDContext.fromJSONObject()', () => {
  it(`Constructs from an object document with an '@context' object context`, async () => {
    const doc = {
      'id': 'https://example.com/actual-used',
      '@id': 'https://example.com/context',
      '@context': {
        '@version': 1.1,
        '@base': 'https://example.com',
        '@vocab': 'https://schema.org/',
        '@language': 'en-NZ',
        'oct': 'https://schema.occultist.dev/',
        'id': '@id',
        'members': { '@id': 'oct:members', '@container': '@list' },
      },
    };

    const bag = new JSONLDContextBag({
      fetcher: makeFetcher([doc]),
    });

    const ctx = await bag.fetchContext('https://example.com/context');

    console.log(ctx)
    assert.equal(ctx.url, 'https://example.com/context');
    assert.equal(ctx.iri, 'https://example.com/actual-used');
    assert.equal(ctx.base, 'https://example.com');
    assert.equal(ctx.version, 1.1);
    assert.equal(ctx.vocab, 'https://schema.org/');
    assert.equal(ctx.language, 'en-NZ');
  });
});
