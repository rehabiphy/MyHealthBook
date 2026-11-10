import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

/* Medicine search on Amazon OpenSearch Service. Adds what the MongoDB
   search can't do: typo tolerance ("paracetmol"), relevance ranking and
   brand → same-salt matches. scripts/indexMedicines.js copies the
   medicine_catalog collection into the index.

   On with SEARCH_ENABLED=true + OPENSEARCH_ENDPOINT (the domain's VPC
   endpoint). Requests are signed with the server's AWS credentials; the
   domain's access policy allows only the backend IAM user. If OpenSearch
   is off or fails, callers fall back to the MongoDB search. */

export const MEDICINE_INDEX = 'medicines';

// app searches give up fast and fall back to MongoDB rather than keep the user waiting
const QUICK = { requestTimeout: 2000, maxRetries: 0 };

export const searchEnabled = () => process.env.SEARCH_ENABLED === 'true' && Boolean(process.env.OPENSEARCH_ENDPOINT);

let client = null;
export function opensearch() {
  if (!client) {
    const endpoint = process.env.OPENSEARCH_ENDPOINT.trim().replace(/\/+$/, '');
    const credentials = defaultProvider();
    client = new Client({
      ...AwsSigv4Signer({ region: process.env.OPENSEARCH_REGION || process.env.AWS_REGION, service: 'es', getCredentials: () => credentials() }),
      node: endpoint.startsWith('http') ? endpoint : `https://${endpoint}`,
      requestTimeout: 5000,
    });
  }
  return client;
}

/* Index layout. Each text field is searchable three ways:
     .ac   — as-you-type prefixes of every word ("telmi" → telmisartan)
     plain — whole words, used for typo-tolerant (fuzzy) matching
     .key  — the whole value lowercased, for sorting and exact salt matches */
export const MEDICINE_INDEX_BODY = {
  settings: {
    number_of_shards: 1,
    // copies besides the original: 2 = one in each of 3 zones (a domain with standby needs a multiple of 3 copies in total)
    number_of_replicas: Number(process.env.OPENSEARCH_REPLICAS ?? 2),
    analysis: {
      tokenizer: {
        word_prefix: { type: 'edge_ngram', min_gram: 1, max_gram: 20, token_chars: ['letter', 'digit'] },
      },
      analyzer: {
        prefix: { type: 'custom', tokenizer: 'word_prefix', filter: ['lowercase'] },
      },
      normalizer: {
        lower: { type: 'custom', filter: ['lowercase', 'trim'] },
      },
    },
  },
  mappings: {
    dynamic: 'strict',
    properties: {
      // shorter names score a little higher, so plain "Paracetamol Tablet" beats long combination products
      name: {
        type: 'text',
        fields: { ac: { type: 'text', analyzer: 'prefix', search_analyzer: 'standard' }, key: { type: 'keyword', normalizer: 'lower' } },
      },
      composition: {
        type: 'text',
        fields: { ac: { type: 'text', analyzer: 'prefix', search_analyzer: 'standard' }, key: { type: 'keyword', normalizer: 'lower', ignore_above: 512 } },
      },
      manufacturer: { type: 'text' },
      packSize: { type: 'keyword', index: false },
      price: { type: 'float' },
      discontinued: { type: 'boolean' },
    },
  },
};

/* Best match first: names starting with the query, names containing the
   query words as whole words ("dolo" → "Dolo 650", not "Dologel"), then
   every query word as a prefix of the name, then typo-tolerant name
   matches, then the same for the composition (so a salt finds its
   brands). Discontinued medicines score a third, so they sink below
   current ones. Equal scores fall back to alphabetical order. */
export async function searchMedicines(q, { from, size }) {
  const query = q
    ? {
        function_score: {
          query: {
            bool: {
              should: [
                { match_phrase_prefix: { name: { query: q, boost: 10 } } },
                { match: { name: { query: q, operator: 'and', boost: 8 } } },
                { match: { 'name.ac': { query: q, operator: 'and', boost: 6 } } },
                { match: { name: { query: q, fuzziness: 'AUTO', prefix_length: 1, boost: 3 } } },
                { match: { 'composition.ac': { query: q, operator: 'and', boost: 2 } } },
                { match: { composition: { query: q, fuzziness: 'AUTO', prefix_length: 1, boost: 1 } } },
              ],
              minimum_should_match: 1,
            },
          },
          functions: [{ filter: { term: { discontinued: true } }, weight: 0.3 }],
          boost_mode: 'multiply',
        },
      }
    : { match_all: {} };

  const { body } = await opensearch().search(
    {
      index: MEDICINE_INDEX,
      body: { query, from, size, sort: q ? ['_score', { 'name.key': 'asc' }] : [{ 'name.key': 'asc' }], track_total_hits: false },
    },
    QUICK,
  );
  return body.hits.hits.map(h => ({ _id: h._id, ...h._source }));
}

/** Current medicines with exactly the same composition, cheapest first. */
export async function sameCompositionMedicines(composition, excludeId, size) {
  const { body } = await opensearch().search(
    {
      index: MEDICINE_INDEX,
      body: {
        query: {
          bool: {
            filter: [{ term: { 'composition.key': composition.toLowerCase().trim() } }, { term: { discontinued: false } }, { exists: { field: 'price' } }],
            must_not: [{ ids: { values: [excludeId] } }],
          },
        },
        sort: [{ price: 'asc' }, { 'name.key': 'asc' }],
        size,
      },
    },
    QUICK,
  );
  return body.hits.hits.map(h => ({ _id: h._id, ...h._source }));
}
