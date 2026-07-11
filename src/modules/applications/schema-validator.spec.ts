import { validateApplicationSchema } from './schema-validator';

const validPage = {
  id: 'p1',
  name: 'Home',
  route: '/',
  root: { id: 'c1', type: 'div', props: {}, styles: {}, bindings: {}, events: {}, children: [] },
};

const validSchema = {
  schemaVersion: '1.0.0',
  metadata: { applicationId: 'app-1', name: 'Test' },
  pages: [validPage],
};

describe('validateApplicationSchema', () => {
  it('accepts a minimal valid schema', () => {
    const result = validateApplicationSchema(validSchema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects null schema', () => {
    const result = validateApplicationSchema(null as never);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('SCHEMA_TYPE');
  });

  it('rejects missing schemaVersion', () => {
    const result = validateApplicationSchema({
      metadata: { applicationId: 'app-1', name: 'Test' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'SCHEMA_VERSION_REQUIRED')).toBe(true);
  });

  it('rejects unsupported schema version', () => {
    const result = validateApplicationSchema({ ...validSchema, schemaVersion: '999.0.0' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'SCHEMA_VERSION_UNSUPPORTED')).toBe(true);
  });

  it('rejects missing metadata', () => {
    const result = validateApplicationSchema({ schemaVersion: '1.0.0' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'METADATA_MISSING')).toBe(true);
  });

  it('rejects duplicate page routes', () => {
    const schema = {
      ...validSchema,
      pages: [
        validPage,
        { ...validPage, id: 'p2', name: 'About', route: '/' },
      ],
    };
    const result = validateApplicationSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'PAGE_ROUTE_DUPLICATE')).toBe(true);
  });

  it('rejects routes without leading slash', () => {
    const schema = {
      ...validSchema,
      pages: [{ ...validPage, route: 'home' }],
    };
    const result = validateApplicationSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'PAGE_ROUTE_FORMAT')).toBe(true);
  });

  it('rejects duplicate component node ids', () => {
    const schema = {
      ...validSchema,
      pages: [{
        ...validPage,
        root: {
          id: 'c1', type: 'div', props: {}, styles: {}, bindings: {}, events: {},
          children: [{ id: 'c1', type: 'span', props: {}, styles: {}, bindings: {}, events: {}, children: [] }],
        },
      }],
    };
    const result = validateApplicationSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'NODE_ID_DUPLICATE')).toBe(true);
  });

  it('rejects missing root component', () => {
    const schema = {
      ...validSchema,
      pages: [{ id: 'p1', name: 'Home', route: '/' }],
    };
    const result = validateApplicationSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'ROOT_REQUIRED')).toBe(true);
  });

  it('rejects prototype-pollution keys', () => {
    const schema = { ...validSchema, constructor: { malicious: true } };
    const result = validateApplicationSchema(schema);
    expect(result.errors.some((e) => e.code === 'PROHIBITED_KEY')).toBe(true);
  });

  it('rejects executable JavaScript in props', () => {
    const schema = {
      ...validSchema,
      pages: [{
        ...validPage,
        root: {
          id: 'c1', type: 'div', props: { onClick: 'javascript:alert(1)' },
          styles: {}, bindings: {}, events: {}, children: [],
        },
      }],
    };
    const result = validateApplicationSchema(schema);
    expect(result.errors.some((e) => e.code === 'EXECUTABLE_CONTENT')).toBe(true);
  });

  it('rejects raw SQL patterns in values', () => {
    const schema = {
      ...validSchema,
      pages: [{
        ...validPage,
        root: {
          id: 'c1', type: 'div', props: { query: 'DROP TABLE users;' },
          styles: {}, bindings: {}, events: {}, children: [],
        },
      }],
    };
    const result = validateApplicationSchema(schema);
    expect(result.errors.some((e) => e.code === 'SQL_CONTENT')).toBe(true);
  });

  it('rejects secret key patterns', () => {
    const schema = {
      ...validSchema,
      pages: [{
        ...validPage,
        root: {
          id: 'c1', type: 'div', props: { apiKey: 'sk-abc123def456ghi789jkl' },
          styles: {}, bindings: {}, events: {}, children: [],
        },
      }],
    };
    const result = validateApplicationSchema(schema);
    expect(result.errors.some((e) => e.code === 'SECRET_CONTENT')).toBe(true);
  });

  it('rejects excessive nesting depth', () => {
    let child: any = { id: 'deep', type: 'div', props: {}, styles: {}, bindings: {}, events: {}, children: [] };
    for (let i = 0; i < 25; i++) {
      child = { id: `n${i}`, type: 'div', props: {}, styles: {}, bindings: {}, events: {}, children: [child] };
    }
    const schema = { ...validSchema, pages: [{ ...validPage, root: child }] };
    const result = validateApplicationSchema(schema);
    expect(result.errors.some((e) => e.code === 'NESTING_DEPTH')).toBe(true);
  });

  it('rejects too many pages', () => {
    const pages = Array.from({ length: 201 }, (_, i) => ({
      id: `p${i}`, name: `Page ${i}`, route: `/page-${i}`,
      root: { id: `c${i}`, type: 'div', props: {}, styles: {}, bindings: {}, events: {}, children: [] },
    }));
    const schema = { ...validSchema, pages };
    const result = validateApplicationSchema(schema);
    expect(result.errors.some((e) => e.code === 'PAGES_MAX_EXCEEDED')).toBe(true);
  });

  it('returns structured errors with code, path, message, severity', () => {
    const result = validateApplicationSchema(null as never);
    expect(result.errors[0]).toHaveProperty('code');
    expect(result.errors[0]).toHaveProperty('path');
    expect(result.errors[0]).toHaveProperty('message');
    expect(result.errors[0]).toHaveProperty('severity');
  });
});
