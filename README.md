# Occultist JSON-LD expand

This is a WIP implementation of the JSON-LD expand algorithm albeit with some differences in its output
when compared to jsonld.js.

Typically jsonld.js will wrap all non-array values within arrays to make the data structure more regular
for later processing. You can test this behaviour in the [JSON-LD.org playground](https://json-ld.org/playground/).
The @occultist/jsonld-expand expand implementation only expands properties, it largely does not create
extra arrays or nest scala values within `@value` objects, unless the value was presented in such
form in the input data.

## Why

The Octiron and Occultist.dev projects require a JSON-LD expansion algorithm. jsonld.js provides that,
and a lot of other functionality that is useful for its creators and other sem-web projects. This
implementation focuses on being small, fast and it creates a less verbose output that Octiron and
Occultist.dev are happy with. It is possible that developers might have to work with the output of the
expansion algorithm, and for developers who might want to experiment with the Octiron.dev framework and
are unfamiliar with JSON-LD, the less change from the authored payload the less confusing adpotion will be.

## Goal

This project is one of many priorities under the Occultist.dev banner. In the short term a minimal and incomplete
expansion algorithm will be developed to get good enough output for projects built with Occultist.dev.
In the future a complete implementation might be developed, but currently this is not on the roadmap.

## Install

```
npm add @occultist/jsonld-expand
```

## Usage

Many JSON-LD features are untested but the basic job of expanding object properties, '@type' values
and '@id' values is implemented.

```
import { expand, JSONLDContextBag } from '@occultist/jsonld-expand';

// optionally allow caching of remote contexts
// a fetcher function can also be passed in to
// alter the fetch behaviour.
const bag = new JSONLDContextBag({ cacheMethod: 'cache' });

const expanded = await expand({
  '@context': {
    'id': '@id',
    '@vocab': 'https://schema.org/',
  }
  'id': 'https://example.com/foo',
  'name': 'Matthew Quinn',
  'website': 'https://matthewquinn.me',
}, { bag });

console.log(expanded);
// {
//   "@id": "https://example.com/foo",
//   "https://schema.org/name": "Matthew Quinn",
//   "https://schema.org/website": "https://matthewquinn.me",
// }
```

## Current working features

These features are some-what tested and appear to be working well. Un-mentioned JSON-LD features may have
partial support but should not be relied on for now.

### Context parsing

Strait-forward context objects appear to work well. The logic for aliasing is non-recursive and is likely to not
work for complex use-cases.

### Property type and IRI expansion

This algorithm will recursively expand all object properties, object `@type` values and object `@id` values.
It uses the `@vocab` defined in the active context and any aliases when doing so.

### Fetching remote contexts

Remote contexts will be fetched and merged if required. The merge behaviour is a quick implementation and has
not been checked against the JSON-LD spec.
