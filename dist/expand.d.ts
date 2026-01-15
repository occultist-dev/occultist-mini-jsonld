export type JSONPrimitive = string | number | boolean | null | undefined;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
export type JSONObject = {
    [member: string]: JSONValue;
};
export interface JSONArray extends Array<JSONValue> {
}
export type IRIObject<Properties extends JSONValue = JSONValue> = Properties & {
    '@id': string;
};
export type TypeObject<Properties extends JSONValue = JSONValue> = Properties & {
    '@type': string | string[];
};
export type ValueObject<Properties extends JSONValue = JSONValue> = Properties & {
    '@value': JSONValue;
};
export type ListObject<Properties extends JSONValue = JSONValue> = Properties & {
    '@list': JSONArray;
};
export type SetObject<Properties extends JSONValue = JSONValue> = Properties & {
    '@set': JSONArray;
};
export type IterableJSONLD<Properties extends JSONValue = JSONValue> = JSONArray | ListObject<Properties> | SetObject<Properties>;
export type Fetcher = typeof fetch;
export type JSONLDContextCache = Map<string, JSONLDContext>;
export type JSONLDSourceDataType = 'null' | 'boolean' | 'number' | 'string' | 'array' | 'object';
export declare class JSONLDContextSource {
    url: string | undefined;
    json: JSONObject | JSONArray;
    datatype: JSONLDSourceDataType;
    constructor(url: string | undefined, json: JSONObject | JSONArray);
}
export declare class JSONLDContextCtx {
    primary: JSONLDContextSource;
    sources: Map<string, JSONLDContextSource>;
    inflight: Set<string>;
    pending: Set<string>;
    failed: Set<string>;
    constructor(primary: JSONLDContextSource);
    hasSource(iri: string): boolean;
    addSource(source: JSONLDContextSource): void;
}
export type CacheMethod = 'dont-cache' | 'cache';
export declare class JSONLDContextBag {
    #private;
    contexts: Map<string, JSONLDContext>;
    fetcher: typeof fetch;
    cacheMethod: CacheMethod;
    constructor({ fetcher, contexts, cacheMethod, }?: {
        fetcher?: typeof fetch;
        contexts?: Map<string, JSONLDContext>;
        cacheMethod?: CacheMethod;
    });
    has(iri: string): boolean;
    get(iri: string): JSONLDContext | undefined;
    set(context: JSONLDContext): void;
}
export type JSONLDContainer = '@list' | '@set' | '@language' | '@index' | '@id' | '@type';
export declare class JSONLDTypeDef {
    id: string;
    type?: string;
    container?: JSONLDContainer;
    context?: JSONLDContext;
    constructor(id: string, type?: string | undefined, container?: JSONLDContainer | undefined, context?: JSONLDContext | undefined);
}
export declare class JSONLDKWAliases {
    '@id': string;
    '@type': string;
    '@container': string;
    '@set': string;
    '@list': string;
    '@graph': string;
}
export declare class JSONLDContext {
    /**
     * The URL used to fetch this context
     */
    url?: string;
    /**
     * The IRI of the context's document.
     *
     * This is only used if there is a single context at the top level of a JSON
     * object response.
     */
    iri?: string;
    /**
     * The base URL that relative IRIs in referencing documents
     * are resolved from.
     */
    base?: string;
    version?: 1.1;
    vocab?: string;
    language?: string;
    aliases: Map<string, string>;
    kwaliases: JSONLDKWAliases;
    types: Map<string, JSONLDTypeDef>;
    cache: Map<string, string>;
    constructor(url: string | undefined, iri: string | undefined, base: string | undefined, vocab: string | undefined, version: 1.1 | undefined, language: string | undefined, aliases: Map<string, string>, kwaliases: JSONLDKWAliases, types: Map<string, JSONLDTypeDef>);
    getOrCreateTypeDef: (termOrType: string | undefined) => JSONLDTypeDef | undefined;
    expandTypes: (dataTypes: string | string[] | undefined) => string | string[];
    expandIRIs: (iris: string | string[] | undefined) => IRIObject<JSONValue>[] | {
        '@id': string;
    };
    static fromOthers(iri: string | undefined, source: JSONLDContextSource, others: JSONLDContext[]): JSONLDContext;
    static fromJSONObject(json: JSONObject, url?: string): JSONLDContext;
    static null(url?: string): JSONLDContext;
    static fetch(iri: string, bag: JSONLDContextBag): Promise<JSONLDContext | undefined>;
    static resolve(source: JSONLDContextSource, bag: JSONLDContextBag): Promise<JSONLDContext | undefined>;
}
export declare function expand(input: JSONValue, { url, bag, }?: {
    url?: string;
    bag?: JSONLDContextBag;
}): Promise<JSONValue>;
/**
 * @description
 * Returns true if the input value is an object.
 *
 * @param value Any value which should come from a JSON source.
 */
export declare function isJSONObject(value: JSONValue): value is JSONObject;
