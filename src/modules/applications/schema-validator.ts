const MAX_NESTING_DEPTH = 20;
const MAX_NODES = 5000;
const MAX_PAGES = 200;
const SUPPORTED_SCHEMA_VERSIONS = ['1.0.0'];

const PROHIBITED_KEYS = ['prototype', 'constructor'];
const EXECUTABLE_PATTERNS = [
  /javascript:/i,
  /<script[\s>]/i,
  /onerror\s*=/i,
  /onclick\s*=/i,
  /onload\s*=/i,
  /onmouseover\s*=/i,
  /eval\s*\(/i,
  /new\s+Function\s*\(/i,
];
const SQL_PATTERNS = [
  /\bDROP\s+TABLE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bALTER\s+TABLE\b/i,
  /\bEXEC\b/i,
  /\bEXECUTE\b/i,
  /\bUNION\s+SELECT\b/i,
];
const SECRET_PATTERNS = [
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/i,
  /sk-[a-zA-Z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
];

interface ValidationError {
  code: string;
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

function err(path: string, message: string, code = 'SCHEMA_INVALID', severity: 'error' | 'warning' = 'error'): ValidationError {
  return { code, path, message, severity };
}

export function validateApplicationSchema(schema: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!schema || typeof schema !== 'object') {
    errors.push(err('$', 'Schema must be a non-null object', 'SCHEMA_TYPE'));
    return { valid: false, errors };
  }

  // Check prototype-pollution keys at root
  for (const key of Object.keys(schema)) {
    if (PROHIBITED_KEYS.includes(key)) {
      errors.push(err('$', `Prohibited key "${key}" at root`, 'PROHIBITED_KEY'));
    }
  }

  // Schema version validation
  if (typeof schema.schemaVersion !== 'string' || !schema.schemaVersion) {
    errors.push(err('schemaVersion', 'schemaVersion is required and must be a non-empty string', 'SCHEMA_VERSION_REQUIRED'));
  } else if (!SUPPORTED_SCHEMA_VERSIONS.includes(schema.schemaVersion)) {
    errors.push(err('schemaVersion', `Unsupported schema version "${schema.schemaVersion}". Supported: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}`, 'SCHEMA_VERSION_UNSUPPORTED'));
  }

  // Metadata validation
  if (schema.metadata && typeof schema.metadata === 'object') {
    const metadata = schema.metadata as Record<string, unknown>;
    if (typeof metadata.applicationId !== 'string') {
      errors.push(err('metadata.applicationId', 'metadata.applicationId is required', 'METADATA_MISSING'));
    }
    if (typeof metadata.name !== 'string') {
      errors.push(err('metadata.name', 'metadata.name is required', 'METADATA_MISSING'));
    }
  } else {
    errors.push(err('metadata', 'metadata is required', 'METADATA_MISSING'));
  }

  // Pages validation
  if (schema.pages !== undefined) {
    if (!Array.isArray(schema.pages)) {
      errors.push(err('pages', 'pages must be an array', 'PAGES_TYPE'));
    } else {
      if (schema.pages.length > MAX_PAGES) {
        errors.push(err('pages', `Too many pages: ${schema.pages.length}, max: ${MAX_PAGES}`, 'PAGES_MAX_EXCEEDED'));
      }

      const seenRoutes = new Set<string>();
      const seenPageIds = new Set<string>();
      const allNodeIds = new Set<string>();
      let nodeCount = 0;

      for (const [index, page] of schema.pages.entries()) {
        if (!page || typeof page !== 'object') {
          errors.push(err(`pages[${index}]`, 'Page must be an object', 'PAGE_TYPE'));
          continue;
        }

        const pagePath = `pages[${index}]`;
        const pageObj = page as Record<string, unknown>;

        // Prohibited keys on page
        for (const key of Object.keys(pageObj)) {
          if (PROHIBITED_KEYS.includes(key)) {
            errors.push(err(`${pagePath}.${key}`, `Prohibited key "${key}"`, 'PROHIBITED_KEY'));
          }
        }

        // Page ID
        if (typeof pageObj.id !== 'string' || !pageObj.id) {
          errors.push(err(`${pagePath}.id`, 'Page id is required', 'PAGE_ID_REQUIRED'));
        } else if (seenPageIds.has(pageObj.id)) {
          errors.push(err(`${pagePath}.id`, `Duplicate page id "${pageObj.id}"`, 'PAGE_ID_DUPLICATE'));
        } else {
          seenPageIds.add(pageObj.id as string);
        }

        // Page name
        if (typeof pageObj.name !== 'string') {
          errors.push(err(`${pagePath}.name`, 'Page name is required', 'PAGE_NAME_REQUIRED'));
        }

        // Page route
        if (typeof pageObj.route !== 'string') {
          errors.push(err(`${pagePath}.route`, 'Page route is required', 'PAGE_ROUTE_REQUIRED'));
        } else {
          if (!pageObj.route.startsWith('/')) {
            errors.push(err(`${pagePath}.route`, `Route "${pageObj.route}" must start with "/"`, 'PAGE_ROUTE_FORMAT'));
          }
          if (seenRoutes.has(pageObj.route)) {
            errors.push(err(`${pagePath}.route`, `Duplicate route "${pageObj.route}"`, 'PAGE_ROUTE_DUPLICATE'));
          } else {
            seenRoutes.add(pageObj.route);
          }
        }

        // Root component
        if (pageObj.root) {
          validateComponentNode(
            pageObj.root as Record<string, unknown>,
            `${pagePath}.root`,
            errors,
            allNodeIds,
            0,
            () => nodeCount++,
          );
        } else {
          errors.push(err(`${pagePath}.root`, 'Root component is required', 'ROOT_REQUIRED'));
        }
      }

      if (nodeCount > MAX_NODES) {
        errors.push(err('pages', `Too many component nodes: ${nodeCount}, max: ${MAX_NODES}`, 'NODES_MAX_EXCEEDED'));
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateComponentNode(
  node: unknown,
  path: string,
  errors: ValidationError[],
  seenIds: Set<string>,
  depth: number,
  countNode: () => void,
): void {
  if (depth > MAX_NESTING_DEPTH) {
    errors.push(err(path, `Maximum nesting depth of ${MAX_NESTING_DEPTH} exceeded`, 'NESTING_DEPTH'));
    return;
  }

  if (!node || typeof node !== 'object') {
    errors.push(err(path, 'Component node must be an object', 'NODE_TYPE'));
    return;
  }

  const nodeObj = node as Record<string, unknown>;

  // Prohibited keys
  for (const key of Object.keys(nodeObj)) {
    if (PROHIBITED_KEYS.includes(key)) {
      errors.push(err(`${path}.${key}`, `Prohibited key "${key}"`, 'PROHIBITED_KEY'));
    }
  }

  // Node ID
  if (typeof nodeObj.id !== 'string' || !nodeObj.id) {
    errors.push(err(`${path}.id`, 'Component id is required', 'NODE_ID_REQUIRED'));
  } else if (seenIds.has(nodeObj.id)) {
    errors.push(err(`${path}.id`, `Duplicate node id "${nodeObj.id}"`, 'NODE_ID_DUPLICATE'));
  } else {
    seenIds.add(nodeObj.id as string);
  }

  // Node type
  if (typeof nodeObj.type !== 'string' || !nodeObj.type) {
    errors.push(err(`${path}.type`, 'Component type is required', 'NODE_TYPE_REQUIRED'));
  }

  countNode();

  // Validate props for dangerous content
  if (nodeObj.props !== undefined) {
    if (typeof nodeObj.props !== 'object' || nodeObj.props === null) {
      errors.push(err(`${path}.props`, 'Props must be an object', 'PROPS_TYPE'));
    } else {
      scanForDangerousValues(nodeObj.props as Record<string, unknown>, `${path}.props`, errors);
    }
  }

  // Validate styles
  if (nodeObj.styles !== undefined) {
    if (typeof nodeObj.styles !== 'object' || nodeObj.styles === null) {
      errors.push(err(`${path}.styles`, 'Styles must be an object', 'STYLES_TYPE'));
    }
  }

  // Validate children
  if (nodeObj.children !== undefined) {
    if (!Array.isArray(nodeObj.children)) {
      errors.push(err(`${path}.children`, 'Children must be an array', 'CHILDREN_TYPE'));
    } else {
      for (const [index, child] of nodeObj.children.entries()) {
        validateComponentNode(child, `${path}.children[${index}]`, errors, seenIds, depth + 1, countNode);
      }
    }
  }
}

function scanForDangerousValues(
  obj: Record<string, unknown>,
  path: string,
  errors: ValidationError[],
  visited = new Set<unknown>(),
): void {
  if (visited.has(obj)) return;
  visited.add(obj);

  for (const [key, value] of Object.entries(obj)) {
    const valuePath = `${path}.${key}`;

    // Prohibited keys
    if (PROHIBITED_KEYS.includes(key)) {
      errors.push(err(valuePath, `Prohibited key "${key}"`, 'PROHIBITED_KEY'));
    }

    if (typeof value === 'string') {
      // Check for executable JavaScript
      if (EXECUTABLE_PATTERNS.some((p) => p.test(value))) {
        errors.push(err(valuePath, 'Value may contain executable code', 'EXECUTABLE_CONTENT'));
      }

      // Check for raw SQL
      if (SQL_PATTERNS.some((p) => p.test(value))) {
        errors.push(err(valuePath, 'Value may contain SQL statements', 'SQL_CONTENT'));
      }

      // Check for secrets
      if (SECRET_PATTERNS.some((p) => p.test(value))) {
        errors.push(err(valuePath, 'Value may contain secrets or credentials', 'SECRET_CONTENT'));
      }
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (value[i] !== null && typeof value[i] === 'object') {
          scanForDangerousValues(value[i] as Record<string, unknown>, `${valuePath}[${i}]`, errors, visited);
        } else if (typeof value[i] === 'string') {
          if (EXECUTABLE_PATTERNS.some((p) => p.test(value[i]))) {
            errors.push(err(`${valuePath}[${i}]`, 'Value may contain executable code', 'EXECUTABLE_CONTENT'));
          }
          if (SQL_PATTERNS.some((p) => p.test(value[i]))) {
            errors.push(err(`${valuePath}[${i}]`, 'Value may contain SQL statements', 'SQL_CONTENT'));
          }
        }
      }
    } else if (value !== null && typeof value === 'object') {
      scanForDangerousValues(value as Record<string, unknown>, valuePath, errors, visited);
    }
  }
}
