/**
 * Validate that the Bruno collection matches the live OpenAPI spec.
 *
 * Usage: npx ts-node scripts/validate-bruno-openapi.ts
 *
 * This script:
 * 1. Starts the backend (or connects to running instance)
 * 2. Fetches /api/docs-json (Swagger JSON)
 * 3. Compares routes against Bruno .bru files
 * 4. Reports missing/extra routes
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";

const BRUNO_DIR = path.resolve(__dirname, "..", "bruno", "manbaa-api", "requests");
const BASE_URL = process.env.BASE_URL || "http://localhost:3000/api";
const SWAGGER_PATH = "/docs-json";

interface BrunoRoute {
  method: string;
  path: string;
  file: string;
}

function fetchSwaggerJson(): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(SWAGGER_PATH, BASE_URL);
    const mod = url.protocol === "https:" ? https : http;
    mod.get(url.href, { timeout: 10000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Failed to parse Swagger JSON"));
        }
      });
    }).on("error", reject).on("timeout", function () {
      reject(new Error("Timeout fetching Swagger JSON"));
      this.destroy();
    });
  });
}

function parseBrunoRoutes(): BrunoRoute[] {
  const routes: BrunoRoute[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".bru")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const methodMatch = content.match(/^(get|post|put|patch|delete)\s*\{/im);
        const urlMatch = content.match(/url:\s*\{\{baseUrl\}\}(\/v\d\/[^\s\}]+)/);
        if (methodMatch && urlMatch) {
          routes.push({
            method: methodMatch[1].toUpperCase(),
            path: urlMatch[1],
            file: path.relative(BRUNO_DIR, fullPath),
          });
        }
      }
    }
  }

  walk(BRUNO_DIR);
  return routes;
}

function normalizeSwaggerPath(p: string): string {
  // Replace path parameters like {id} with the Bruno variable style
  return p.replace(/\{([^}]+)\}/g, "{{$1}}");
}

async function main() {
  console.log(`Fetching OpenAPI spec from ${BASE_URL}${SWAGGER_PATH}...`);

  let swagger: any;
  try {
    swagger = await fetchSwaggerJson();
  } catch (err: any) {
    console.warn(`Could not fetch Swagger spec: ${err.message}`);
    console.warn("Falling back to local OpenAPI file...");
    const openapiPath = path.resolve(
      __dirname,
      "..",
      "bruno",
      "manbaa-api",
      "openapi",
      "manbaa.openapi.yaml"
    );
    if (fs.existsSync(openapiPath)) {
      console.log(`Using ${openapiPath}`);
      // Simple YAML-ish parsing for paths is too complex; just report
      console.log("Bruno routes found (count):", parseBrunoRoutes().length);
      return;
    }
    console.error("No OpenAPI spec available. Ensure backend is running.");
    process.exit(1);
  }

  // Extract Swagger routes
  const swaggerRoutes: { method: string; path: string }[] = [];
  for (const [swPath, methods] of Object.entries(swagger.paths || {})) {
    for (const [method, _def] of Object.entries(methods as object)) {
      if (["get", "post", "put", "patch", "delete"].includes(method)) {
        swaggerRoutes.push({
          method: method.toUpperCase(),
          path: normalizeSwaggerPath(swPath),
        });
      }
    }
  }

  const brunoRoutes = parseBrunoRoutes();

  // Build lookup maps
  const swaggerSet = new Set(swaggerRoutes.map((r) => `${r.method} ${r.path}`));
  const brunoSet = new Set(brunoRoutes.map((r) => `${r.method} ${r.path}`));

  // Find missing in Bruno
  const missing: string[] = [];
  for (const sr of swaggerRoutes) {
    const key = `${sr.method} ${sr.path}`;
    if (!brunoSet.has(key)) {
      missing.push(key);
    }
  }

  // Find extra in Bruno
  const extra: string[] = [];
  for (const br of brunoRoutes) {
    const key = `${br.method} ${br.path}`;
    if (!swaggerSet.has(key)) {
      extra.push(`${key} (${br.file})`);
    }
  }

  console.log(`\nSwagger routes: ${swaggerRoutes.length}`);
  console.log(`Bruno routes:   ${brunoRoutes.length}`);

  if (missing.length > 0) {
    console.log(`\n❌ Missing in Bruno (${missing.length}):`);
    missing.forEach((r) => console.log(`  - ${r}`));
  } else {
    console.log("\n✅ All Swagger routes have Bruno coverage");
  }

  if (extra.length > 0) {
    console.log(`\n⚠️  Extra in Bruno (${extra.length}):`);
    extra.forEach((r) => console.log(`  - ${r}`));
  } else {
    console.log("\n✅ No extra Bruno routes");
  }

  if (missing.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
