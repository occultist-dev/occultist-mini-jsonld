import jsonld from 'jsonld';
import { expand, JSONLDContextBag } from '../lib/expand.ts';

const bag = new JSONLDContextBag({
  fetcher: fetch,
});

Deno.bench('@occultist/jsonld-expand Expand large object using bag', { warmup: 100, n: 10000 }, async () => {
  await expand(value, { bag });
});

Deno.bench('@occultist/jsonld-expand Expand large object', { warmup: 100, n: 10000 }, async () => {
  await expand(value);
});

Deno.bench('jsonld.jd expand large object', { warmup: 100, n: 10000 }, async () => {
  await jsonld.expand(value);
}); 


const value = {
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
