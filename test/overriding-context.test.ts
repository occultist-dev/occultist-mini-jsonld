import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {Registry} from '@occultist/occultist';
import {expand, JSONLDContextStore} from '../lib/expand.ts';
import { normalizeJSONLD } from './utils/normalizeJSONLD.ts';
import jsonld from 'jsonld';


function makeTestDeps() {
  const registry = new Registry({
    rootIRI: 'https://example.com',
  });

  registry.http.get('/foo-bars')
    .public()
    .handle('application/ld+json', JSON.stringify({
      '@context': {
        '@vocab': 'https://schema.example.com/',
        'oct': 'https://schema.occultist.dev/',
      },
      'oct:members': [
        {
          '@type': 'FooBar',
          '@context': {
            '@vocab': 'https://schema.example.com/',
            'scm': 'https://schema.org/'
          },
          'scm:name': 'Foo Bar',
          'oct:name': 'Foe Fee',
        },
      ],
    }));

  const store = new JSONLDContextStore({
    fetcher: (url: string, init: RequestInit) => registry.handleRequest(
      new Request(url, init),
    ),
  });

  return { registry, store };
}


describe('Overriding context', () => {
  it('Merges the types from the parent context into the child', async () => {
    const { registry, store } = makeTestDeps();
    const res = await registry.handleRequest(
      new Request('https://example.com/foo-bars')
    );
    const json = await res.json();
    const test = await jsonld.expand(json);

    await expand(json, { store });

    assert.deepEqual(normalizeJSONLD(json), test);
  });
});

