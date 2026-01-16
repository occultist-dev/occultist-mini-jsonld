/**
 * These bench marks are used as healthchecks for this libraries development
 * since @octiron/jsonld-expand edits the input object the test json is created
 * from a factory fn for each run to prevent the first run from expanding
 * the input for all later runs.
 *
 * @occultist/jsonld-expand is still in development and is missing most of JSON-LD's
 * features. These benchmarks are not designed to create a fair comparison for these
 * libraries.
 */

import jsonld from 'jsonld';
import { expand, JSONLDContextStore, JSONObject } from '../lib/expand.ts';
import { Registry } from '@occultist/occultist';

const registry = new Registry({
  rootIRI: 'https://example.com',
});

registry.http.get('/context1')
  .public()
  .handle('application/ld+json', JSON.stringify({
    '@context': {
      '@vocab': 'https://schema.org/',
    },
  }));

registry.http.get('/context2')
  .public()
  .handle('application/ld+json', JSON.stringify({
    '@context': {
      'name': 'http://xmlns.com/foaf/0.1/name',
      'homepage': 'http://xmlns.com/foaf/0.1/homepage',
      '@vocab': 'https://schema.org/',
    },
  }));

registry.http.get('/context3')
  .public()
  .handle('application/ld+json', JSON.stringify({
    '@context': [
      'https://example.com/context1',
      'https://example.com/context2',
      {
        'oct': 'https://schema.occultist.dev/',
      },
    ]
  }));

registry.http.get('/context4')
  .public()
  .handle('application/ld+json', JSON.stringify({
    '@context': {
      'foaf': 'http://xmlns.com/foaf/0.1/',
    }
  }));

const store = new JSONLDContextStore({
  fetcher: (url, init) => {
    return registry.handleRequest(
      new Request(url, init)
    );
  }
});

const storeCache = new JSONLDContextStore({
  cacheMethod: 'cache',
  fetcher: (url, init) => {
    return registry.handleRequest(
      new Request(url, init)
    );
  }
});

const documentLoader = async (url) => {
  const req = new Request(url, { headers: { 'Accept': 'application/ld+json' } });
  const res = await registry.handleRequest(req);
  const document = await res.json();

  return {
    document,
    documentUrl: url,
  };
};

const cache = new Map<string, JSONObject>();
const documentLoaderCache = async (url) => {
  if (cache.has(url)) {
    const document = cache.get(url);

    return {
      document,
      documentUrl: url,
    };
  }

  const req = new Request(url, { headers: { 'Accept': 'application/ld+json' } });
  const res = await registry.handleRequest(req);
  const document = await res.json();

  cache.set(url, document);

  return {
    document,
    documentUrl: url,
  };
};

Deno.bench('@occultist/jsonld-expand Expand large object', { warmup: 100, n: 10000 }, async () => {
  await expand(big());
});

Deno.bench('jsonld.jd expand large object', { warmup: 100, n: 10000 }, async () => {
  await jsonld.expand(big());
}); 

/**
 * Fetch without cache currently performs badly compared to jsonld.js relative to other
 * tests. 
 */
Deno.bench('@occultist/jsonld-expand fetch', { warmup: 100, n: 10000 }, async () => {
  await expand(remote(), { store });
});

Deno.bench('@occultist/jsonld-expand fetch cache', { warmup: 100, n: 10000 }, async () => {
  await expand(remote(), { store: storeCache });
});

Deno.bench('jsonld.jd fetch', { warmup: 100, n: 10000 }, async () => {
  await jsonld.expand(remote(), {
    documentLoader,
  });
}); 

Deno.bench('jsonld.jd fetch cache', { warmup: 100, n: 10000 }, async () => {
  await jsonld.expand(remote(), {
    documentLoader: documentLoaderCache,
  });
}); 


const remote = () => ({
  '@context': [
    'https://example.com/context3',
  ],
  '@id': 'http://example.com/remote',
  '@type': ['Test', 'oct:Foo'],
  'name': 'Matthew Quinn',
  'homepage': 'https://example.com',
  'oct:foo': {
    '@context': 'https://example.com/context4',
    'foaf:depiction': 'https://example.com/face',
  },
})

const big = () => ({
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
});
