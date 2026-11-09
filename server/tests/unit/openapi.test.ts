import { describe, expect, it } from 'vitest';
import { openApiDocument } from '../../src/openapi.js';

describe('OpenAPI contract', () => {
  it('defines all implemented route paths and bearer security', () => {
    expect(Object.keys(openApiDocument.paths)).toHaveLength(20);
    expect(openApiDocument.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
    expect(openApiDocument.servers).toEqual([{ url: '/' }]);
  });
  it('has resolved schema references and documented permission errors', () => {
    const json = JSON.stringify(openApiDocument);
    for (const match of json.matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)) {
      expect(openApiDocument.components.schemas).toHaveProperty(match[1]);
    }
    for (const path of Object.values(openApiDocument.paths)) {
      for (const [method, operation] of Object.entries(path)) {
        if (!['get', 'post', 'put', 'delete'].includes(method)) continue;
        if ('x-permission' in operation) expect(operation.responses).toHaveProperty('403');
      }
    }
  });
});
