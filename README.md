# Occultist JSON-LD expand

This is a WIP implementation of the JSON-LD expand algorithm albeit with some differences in its output
when compared to jsonld.js.

Typically JSON-LD will wrap all non-array values within arrays to normalize the output. You can 
test this behaviour in the [JSON-LD.org playground](https://json-ld.org/playground/). The Occultist
expand implementation only expands properties, it largely does not create extra arrays or nest scala
values within '@value' objects, unless the value was presented in such form by the input data.

## Why

The Octiron and Occultist.dev projects require a JSON-LD expansion algorithm. jsonld.js provides that,
and a lot of other functionality that is useful for its creators and other sem-web projects. This
implementation focuses on being small, fast and it creates a less verbose output that Octiron and
Occultist.dev are happy with. It is possible that developers might have to work with the output of the
expansion algorithm, and it is my opinion for the @octiron/octiron project, less change from the
JSON-LD the developer authored, the less confusing it will be.

## Install

```
npm add @occultist/jsonld-expand
deno add jsr:@occutlist/jsonld-expand
```

## Usage

Many JSON-LD features are untested but the basic job of expanding object properties, '@type' values
and '@id' values is implemented.

```
import { expand } from '@occultist/jsonld-expand';

const expanded = await expand({
  '@context': {
    '@vocab': 'https://schema.org/',
  }
  'name': 'Matthew Quinn',
  'website': 'https://matthewquinn.me',
});

console.log(expanded);
// {
//   "https://schema.org/name": "Matthew Quinn",
//   "https://schema.org/website": "https://matthewquinn.me",
// }
```
