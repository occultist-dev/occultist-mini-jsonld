import jsonld from 'jsonld';
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {expand, JSONLDContext, JSONLDContextBag, type IRIObject, type JSONArray, type JSONValue} from '../lib/expand.ts';


/**
 * Recursively updates the JSON-ld to be in normal expanded form
 * so it can be compared to the output of the jsonld.js expand function.
 */
function normalizeJSONLD(value: JSONValue): JSONValue {
  function innerArray(value: JSONValue): JSONValue {
    if (!Array.isArray(value)) {
      if (typeof value === 'boolean' ||
          typeof value === 'number' ||
          typeof value === 'string') {
        return { '@value': value }
      }

      for (const [key2, value2] of Object.entries(value)) {
        value[key2] = inner(value2, key2);
      }

      return value;
    }

    for (let i = 0, length = value.length; i < length; i++) {
      value[i] = inner(value[i]);
    }

    return value;
  }

  function inner(value: JSONValue, key?: string): JSONValue {
    if (!Array.isArray(value)) {
      if (key === '@id') return value;
      if (key === '@type') return [value];

      if (typeof value === 'boolean' ||
          typeof value === 'number' ||
          typeof value === 'string') {
        return [{ '@value': value }]
      }

      for (const [key2, value2] of Object.entries(value)) {
        value[key2] = inner(value2, key2);
      }

      return [value];
    }

    for (let i = 0, length = value.length; i < length; i++) {
      value[i] = innerArray(value[i]);
    }

    return value;
  }

  if (value == null) return value;
  switch (typeof value) {
    case 'boolean': return value;
    case 'number': return value;
    case 'string': return value;
  }

  let normalized: JSONArray;

  if (Array.isArray(value)) {
    normalized = value;

    for (let i = 0, length = value.length; i < length; i++) {
      normalized[i] = innerArray(normalized[i]);
    }
  } else {
    normalized = [value];
    for (const [key, item] of Object.entries(value)) {
      value[key] = inner(item, key);
    }
  }

  return normalized;
}


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

    const ctx = await JSONLDContext.fetch('https://example.com/context', bag);

    assert.equal(ctx.url, 'https://example.com/context');
    assert.equal(ctx.base, 'https://example.com');
    assert.equal(ctx.version, 1.1);
    assert.equal(ctx.vocab, 'https://schema.org/');
    assert.equal(ctx.language, 'en-NZ');
  });
});

describe('parse()', () => {
  it('Expands JSON-LD', async () => {
    const result = await expand(structuredClone(small));
    const normal = normalizeJSONLD(result);

    assert.deepEqual(normal, await jsonld.expand(small));
  });
  it('Parses JSON-LD', { only: true }, async () => {
    const result = await expand(structuredClone(large));
    const normal = normalizeJSONLD(result);

    assert.deepEqual(normal, await jsonld.expand(large));
  });


});

const small = {
  "@id": "http://store.example.com/",
  "@type": "Store",
  "name": "Links Bike Shop",
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

const large = {
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


