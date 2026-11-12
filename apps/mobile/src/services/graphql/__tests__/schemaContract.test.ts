import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSchema, type DocumentNode, validate } from 'graphql';
import * as operations from '../operations';

/**
 * Contract test: every operation the app sends must be valid against the
 * API's generated schema (apps/api/schema.graphql). Catches renamed fields,
 * wrong argument types or missing inputs without running the server.
 */
const schema = buildSchema(
  readFileSync(join(__dirname, '../../../../../api/schema.graphql'), 'utf8'),
);

const documents = Object.entries(operations).filter(
  (entry): entry is [string, DocumentNode] =>
    typeof entry[1] === 'object' && !Array.isArray(entry[1]) && entry[1].kind === 'Document',
);

describe('GraphQL operations match the API schema', () => {
  it('finds the operations', () => {
    expect(documents.length).toBeGreaterThanOrEqual(10);
  });

  it.each(documents.filter(([name]) => !name.endsWith('_FIELDS')))('%s is valid', (_name, doc) => {
    expect(validate(schema, doc).map((e) => e.message)).toEqual([]);
  });
});
