import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {JSONLDContextBag, type IRIObject, expand} from '../lib/expand.ts';


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

const jsonld = {
    "@id": "http://store.example.com/",
    "@type": "Store",
    "name": "Links Bike Shop",
    "description": "The most \"linked\" bike store on earth!",
    "product": [
        {
            "@id": "p:links-swift-chain",
            "@type": "Product",
            "name": "Links Swift Chain",
            "description": "A fine chain with many links.",
            "category": ["cat:parts", "cat:chains"],
            "price": "10.00",
            "stock": 10
        },
        {
            "@id": "p:links-speedy-lube",
            "@type": "Product",
            "name": "Links Speedy Lube",
            "description": "Lubricant for your chain links.",
            "category": ["cat:lube", "cat:chains"],
            "price": "5.00",
            "stock": 20
        }
    ],
    "@context": {
        "Store": "http://ns.example.com/store#Store",
        "Product": "http://ns.example.com/store#Product",
        "product": "http://ns.example.com/store#product",
        "category":
        {
          "@id": "http://ns.example.com/store#category",
          "@type": "@id"
        },
        "price": "http://ns.example.com/store#price",
        "stock": "http://ns.example.com/store#stock",
        "name": "http://purl.org/dc/terms/title",
        "description": "http://purl.org/dc/terms/description",
        "p": "http://store.example.com/products/",
        "cat": "http://store.example.com/category/"
    }
};

describe('parse()', () => {

  it('Parses JSON-LD', {only:true}, async () => {
    const output = await expand(jsonld, {});

    console.log(JSON.stringify(output, null, 2));
  });

});
