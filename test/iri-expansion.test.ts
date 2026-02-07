import test, {describe, it} from "node:test";
import {expand} from "../lib/expand.ts";
import assert from "assert/strict";


describe('It expands IRIs', () => {
  it('Expands terms to IRIs using vocab', async () => {
    const json: any = {
      '@context': {
        '@vocab': 'https://schema.org/'
      },
      'name': 'Foo Bar',
    };

    await expand(json);

    assert.equal(json['https://schema.org/name'], 'Foo Bar');
  });

  // it('Expands terms to IRIs using aliases', async () => {
  //   const json: any = {
  //     '@context': {
  //       scm: 'https://schema.org/'
  //     },
  //     'scm:name': 'Foo Bar',
  //   };

  //   await expand(json);

  //   assert.equal(json['https://schema.org/name'], 'Foo Bar');
  // });

  // it('Preserves iri properties to IRIs', async () => {
  //   const json: any = {
  //     'https://schema.org/name': 'Foo Bar',
  //   };

  //   await expand(json);

  //   assert.equal(json['https://schema.org/name'], 'Foo Bar');
  // });
});
