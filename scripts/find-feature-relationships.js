#!/usr/bin/env node
/**
 * find-feature-relationships.js --- Token-light file & function relationship map
 * Gives files AND functions directly wired to a target feature, page, file, or endpoint.
 * Built for MyChats (Next.js 16 App Router + Express/TypeDI/Mongoose Monorepo).
 *
 * Problem it solves:
 *   Grep searches across entire repositories can pull in hundreds of lines and thousands of tokens.
 *   This script answers:
 *     1. "What files are directly wired to feature/page/file X?" (~150-700 tokens)
 *     2. "How does data flow from frontend to backend for function/endpoint Y?" (Exact line numbers for API -> Route -> Controller -> Service -> Model)
 *
 * Levels (File Mode):
 *   Level 0 = Entry Target file itself (Page / Route / Controller / Service / Component) + Domain & Counterpart link
 *   Level 1 = Direct imports / immediate architecture (1 hop)
 *   Level 2 = Transitive dependencies / models / hooks / utils (2 hops)
 *
 * Function / Flow Mode:
 *   --fn <name>       = Traces function callers, backend route, controller, service (data provider), and model queries with line numbers.
 *   --call <endpoint> = Traces endpoint (/api/...) to route, controller, service, models, and frontend callers.
 *   --functions       = Lists all function spans (name, lines, calls) for the target file or feature.
 *
 * Usage:
 *   node scripts/find-feature-relationships.js --fn <functionName> [--json]
 *   node scripts/find-feature-relationships.js --call <endpoint> [--json]
 *   node scripts/find-feature-relationships.js --page <route> [--functions] [--depth 0|1|2] [--json]
 *   node scripts/find-feature-relationships.js --file <relPath> [--functions] [--depth 0|1|2] [--json]
 *   node scripts/find-feature-relationships.js --feature <keyword> [--functions] [--depth 0|1|2] [--json]
 *
 * Examples:
 *   node scripts/find-feature-relationships.js --fn getMessages
 *   node scripts/find-feature-relationships.js --fn createMessage
 *   node scripts/find-feature-relationships.js --call /api/chat/messages
 *   node scripts/find-feature-relationships.js --page / --functions
 *   node scripts/find-feature-relationships.js --file backend/src/modules/chat/chat.service.ts --functions
 *   node scripts/find-feature-relationships.js --feature sse --depth 1
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const FRONTEND_ROOT = path.join(ROOT, 'frontend/src');
const BACKEND_ROOT = path.join(ROOT, 'backend/src');

// Domain modules in MyChats backend
const DOMAIN_MODULES = [
  'auth',
  'chat',
  'settings',
  'tenant',
  'todos',
  'tools',
];

function toPosix(p) {
  if (!p) return '';
  return p.split(path.sep).join('/');
}

function toRel(p) {
  return toPosix(path.relative(ROOT, p));
}

function printHelp() {
  console.log(`
find-feature-relationships.js --- file & function relationship map (token-light)
Built for MyChats (Next.js 16 App Router + Express/TypeDI/Mongoose)

Function & Data Flow Trace (with line numbers):
  node scripts/find-feature-relationships.js --fn <functionName> [--json]
  node scripts/find-feature-relationships.js --call <endpoint> [--json]

File Relationship Map:
  node scripts/find-feature-relationships.js --page <route> [--functions] [--depth 0|1|2] [--json]
  node scripts/find-feature-relationships.js --file <relPath> [--functions] [--depth 0|1|2] [--json]
  node scripts/find-feature-relationships.js --feature <keyword> [--functions] [--depth 0|1|2] [--json]

Depth:
  0 = Entry Target only (Level 0: file, domain, role, counterparts)
  1 = Level 0 + Direct imports (Level 1: immediate wiring) [default probe]
  2 = Level 0 + Level 1 + Level 2 (Transitive: models, utils, config) [default]

Examples:
  # Trace full data pipeline for a function (Frontend API -> Route -> Controller -> Service -> Model):
  node scripts/find-feature-relationships.js --fn getMessages
  node scripts/find-feature-relationships.js --fn createMessage
  node scripts/find-feature-relationships.js --fn login
  node scripts/find-feature-relationships.js --fn getTodos

  # Trace an endpoint:
  node scripts/find-feature-relationships.js --call /api/chat/messages
  node scripts/find-feature-relationships.js --call /api/todos

  # List all functions in a file with line spans:
  node scripts/find-feature-relationships.js --file backend/src/modules/chat/chat.service.ts --functions
  node scripts/find-feature-relationships.js --file frontend/src/lib/api.ts --functions
  node scripts/find-feature-relationships.js --page / --functions

  # File dependency map:
  node scripts/find-feature-relationships.js --page / --depth 1
  node scripts/find-feature-relationships.js --feature chat --depth 1
`);
}

function fileExists(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function lineCount(p) {
  try {
    return fs.readFileSync(p, 'utf8').split('\n').length;
  } catch {
    return '?';
  }
}

function walkDir(dir, filter) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.next' || e.name === 'dist' || e.name === '.git') continue;
        stack.push(full);
      } else if (e.isFile() && (!filter || filter(e.name))) {
        out.push(full);
      }
    }
  }
  return out;
}

// -------------------------------------------------------------
// BACKEND ARCHITECTURE PARSERS
// -------------------------------------------------------------

let _cachedRoutes = null;
function getAllBackendRoutes() {
  if (_cachedRoutes) return _cachedRoutes;
  const modDir = path.join(BACKEND_ROOT, 'modules');
  const routes = [];
  if (!fs.existsSync(modDir)) return [];

  for (const d of fs.readdirSync(modDir)) {
    const subDir = path.join(modDir, d);
    if (!fs.existsSync(subDir) || !fs.statSync(subDir).isDirectory()) continue;
    for (const f of fs.readdirSync(subDir)) {
      if (!f.endsWith('.route.ts')) continue;
      const abs = path.join(subDir, f);
      const rel = toRel(abs);
      try {
        const content = fs.readFileSync(abs, 'utf8');
        const lines = content.split('\n');
        let basePath = '';
        const pathMatch = content.match(/public\s+path\s*=\s*['"]([^'"]+)['"]/);
        if (pathMatch) basePath = pathMatch[1];

        // Find controller instance name: e.g. public chatController = new ChatController();
        const ctrlMatch = content.match(/public\s+(\w+Controller)\s*=\s*new\s+(\w+)\(\)/);
        const ctrlVar = ctrlMatch ? ctrlMatch[1] : null;
        const ctrlClass = ctrlMatch ? ctrlMatch[2] : null;

        lines.forEach((line, idx) => {
          const m = line.match(/this\.router\.(get|post|put|delete|patch)\(([^,]+),.*this\.(\w+)\.(\w+)/);
          if (m) {
            const httpMethod = m[1].toUpperCase();
            let rawPath = m[2].trim();
            // replace `${this.path}` with basePath
            rawPath = rawPath.replace(/`?\$\{this\.path\}`?/g, basePath);
            rawPath = rawPath.replace(/['"`]/g, '').trim();

            const cInstance = m[3];
            const handler = m[4];
            routes.push({
              domain: d,
              routeFile: rel,
              line: idx + 1,
              httpMethod,
              endpoint: rawPath,
              handler,
              controllerVar: cInstance || ctrlVar,
              controllerClass: ctrlClass,
            });
          }
        });
      } catch {}
    }
  }
  _cachedRoutes = routes;
  return routes;
}

let _cachedControllers = null;
function getAllControllers() {
  if (_cachedControllers) return _cachedControllers;
  const modDir = path.join(BACKEND_ROOT, 'modules');
  const controllers = [];
  if (!fs.existsSync(modDir)) return [];

  for (const d of fs.readdirSync(modDir)) {
    const subDir = path.join(modDir, d);
    if (!fs.existsSync(subDir) || !fs.statSync(subDir).isDirectory()) continue;
    for (const f of fs.readdirSync(subDir)) {
      if (!f.endsWith('.controller.ts')) continue;
      const abs = path.join(subDir, f);
      const rel = toRel(abs);
      try {
        const content = fs.readFileSync(abs, 'utf8');
        const lines = content.split('\n');
        let curHandler = null;
        let curStartLine = 0;
        let serviceCalls = [];

        lines.forEach((line, idx) => {
          const hm = line.match(/public\s+(\w+)\s*=\s*(?:async\s*)?\(/);
          if (hm) {
            if (curHandler) {
              controllers.push({
                domain: d,
                controllerFile: rel,
                handler: curHandler,
                startLine: curStartLine,
                endLine: idx,
                serviceCalls: [...serviceCalls],
              });
            }
            curHandler = hm[1];
            curStartLine = idx + 1;
            serviceCalls = [];
          }

          if (curHandler) {
            // Find service calls: this.chatService.getMessages(...)
            const sc = line.match(/this\.(\w+Service)\.(\w+)\(/);
            if (sc) {
              serviceCalls.push({
                serviceVar: sc[1],
                serviceMethod: sc[2],
                line: idx + 1,
              });
            }
          }
        });

        if (curHandler) {
          controllers.push({
            domain: d,
            controllerFile: rel,
            handler: curHandler,
            startLine: curStartLine,
            endLine: lines.length,
            serviceCalls: [...serviceCalls],
          });
        }
      } catch {}
    }
  }
  _cachedControllers = controllers;
  return controllers;
}

let _cachedServices = null;
function getAllServices() {
  if (_cachedServices) return _cachedServices;
  const modDir = path.join(BACKEND_ROOT, 'modules');
  const services = [];
  if (!fs.existsSync(modDir)) return [];

  for (const d of fs.readdirSync(modDir)) {
    const subDir = path.join(modDir, d);
    if (!fs.existsSync(subDir) || !fs.statSync(subDir).isDirectory()) continue;
    for (const f of fs.readdirSync(subDir)) {
      if (!f.endsWith('.service.ts')) continue;
      const abs = path.join(subDir, f);
      const rel = toRel(abs);
      try {
        const content = fs.readFileSync(abs, 'utf8');
        const lines = content.split('\n');
        let curMethod = null;
        let curStartLine = 0;
        let modelQueries = [];

        lines.forEach((line, idx) => {
          const mm = line.match(/public\s+(?:async\s+)?(\w+)\s*\(/);
          if (mm) {
            if (curMethod) {
              services.push({
                domain: d,
                serviceFile: rel,
                method: curMethod,
                startLine: curStartLine,
                endLine: idx,
                modelQueries: [...modelQueries],
              });
            }
            curMethod = mm[1];
            curStartLine = idx + 1;
            modelQueries = [];
          }

          if (curMethod) {
            // Match Model queries: Model.find, Model.create, Model.findById, etc.
            const mq = line.match(/(\w+Model)\.(\w+)\(/);
            if (mq) {
              modelQueries.push({
                model: mq[1],
                op: mq[2],
                line: idx + 1,
                raw: line.trim(),
              });
            }
          }
        });

        if (curMethod) {
          services.push({
            domain: d,
            serviceFile: rel,
            method: curMethod,
            startLine: curStartLine,
            endLine: lines.length,
            modelQueries: [...modelQueries],
          });
        }
      } catch {}
    }
  }
  _cachedServices = services;
  return services;
}

// -------------------------------------------------------------
// FRONTEND API PARSER & CALLERS
// -------------------------------------------------------------

let _cachedFrontendApi = null;
function getFrontendApiMethods() {
  if (_cachedFrontendApi) return _cachedFrontendApi;
  const apiFile = path.join(FRONTEND_ROOT, 'lib/api.ts');
  const methods = [];
  if (!fileExists(apiFile)) return [];

  try {
    const content = fs.readFileSync(apiFile, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      // async getMessages(...
      const m = line.match(/^\s*async\s+(\w+)\s*\(/);
      if (m && idx > 180) {
        const methodName = m[1];
        let endpoint = null;
        let httpMethod = 'GET';
        let endLine = idx + 1;

        // scan next lines for request(...)
        for (let j = idx; j < Math.min(idx + 25, lines.length); j++) {
          const reqMatch = lines[j].match(/request(?:<[^>]+>)?\s*\(\s*[`'"]([^`'"]+)[`'"]/);
          if (reqMatch) {
            endpoint = reqMatch[1];
            // clean up template parameters like ?${params.toString()}
            endpoint = endpoint.replace(/\?\$\{.*\}/, '');
          }
          const methodMatch = lines[j].match(/method:\s*['"](GET|POST|PUT|DELETE|PATCH)['"]/);
          if (methodMatch) {
            httpMethod = methodMatch[1];
          }
          if (lines[j].trim() === '},' || lines[j].trim() === '}') {
            endLine = j + 1;
            break;
          }
        }

        methods.push({
          apiFile: 'frontend/src/lib/api.ts',
          methodName,
          startLine: idx + 1,
          endLine,
          endpoint,
          httpMethod,
        });
      }
    });
  } catch {}

  _cachedFrontendApi = methods;
  return methods;
}

function findFrontendCallers(apiMethodName) {
  const callers = [];
  const searchDirs = [
    path.join(FRONTEND_ROOT, 'app'),
    path.join(FRONTEND_ROOT, 'components'),
    path.join(FRONTEND_ROOT, 'hooks'),
  ];

  for (const sDir of searchDirs) {
    const files = walkDir(sDir, f => f.endsWith('.tsx') || f.endsWith('.ts'));
    for (const f of files) {
      try {
        const content = fs.readFileSync(f, 'utf8');
        if (!content.includes(apiMethodName)) continue;
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          const re = new RegExp(`api\\.${apiMethodName}\\b`);
          if (re.test(line)) {
            callers.push({
              file: toRel(f),
              line: idx + 1,
              code: line.trim(),
            });
          }
        });
      } catch {}
    }
  }

  return callers;
}

// -------------------------------------------------------------
// END-TO-END DATA FLOW TRACER
// -------------------------------------------------------------

function traceFunctionChain(query) {
  const qLower = query.toLowerCase().trim();
  const routes = getAllBackendRoutes();
  const controllers = getAllControllers();
  const services = getAllServices();
  const feApiList = getFrontendApiMethods();

  const results = [];

  // Match Frontend API
  const matchedFe = feApiList.filter(
    fe =>
      fe.methodName.toLowerCase() === qLower ||
      fe.methodName.toLowerCase().includes(qLower) ||
      (fe.endpoint && fe.endpoint.toLowerCase().includes(qLower))
  );

  // Match Backend Route
  const matchedRoutes = routes.filter(
    r =>
      r.handler.toLowerCase() === qLower ||
      r.handler.toLowerCase().includes(qLower) ||
      r.endpoint.toLowerCase().includes(qLower)
  );

  // Match Backend Controller
  const matchedControllers = controllers.filter(
    c => c.handler.toLowerCase() === qLower || c.handler.toLowerCase().includes(qLower)
  );

  // Match Backend Service
  const matchedServices = services.filter(
    s => s.method.toLowerCase() === qLower || s.method.toLowerCase().includes(qLower)
  );

  // Collect unique identifiers
  const targetKeys = new Set();
  matchedFe.forEach(f => targetKeys.add(f.methodName));
  matchedRoutes.forEach(r => targetKeys.add(r.handler));
  matchedControllers.forEach(c => targetKeys.add(c.handler));
  matchedServices.forEach(s => targetKeys.add(s.method));

  // If query is an endpoint like /api/chat/messages
  if (qLower.startsWith('/api') || qLower.startsWith('api/')) {
    const norm = qLower.startsWith('/') ? qLower : '/' + qLower;
    routes.forEach(r => {
      if (r.endpoint.toLowerCase().startsWith(norm) || norm.startsWith(r.endpoint.toLowerCase())) {
        targetKeys.add(r.handler);
      }
    });
  }

  for (const key of targetKeys) {
    const keyLower = key.toLowerCase();

    // 1. Frontend API definition
    const fe = feApiList.find(f => f.methodName.toLowerCase() === keyLower) || null;

    // 2. Frontend UI Callers
    const callers = fe ? findFrontendCallers(fe.methodName) : [];

    // 3. Backend Route
    const route =
      routes.find(r => r.handler.toLowerCase() === keyLower) ||
      (fe && fe.endpoint ? routes.find(r => fe.endpoint.startsWith(r.endpoint) || r.endpoint.startsWith(fe.endpoint)) : null) ||
      null;

    // 4. Backend Controller
    const handlerName = (route ? route.handler : key).toLowerCase();
    const ctrl = controllers.find(c => c.handler.toLowerCase() === handlerName) || null;

    // 5. Backend Service (Data Provider)
    let srv = null;
    if (ctrl && ctrl.serviceCalls && ctrl.serviceCalls.length > 0) {
      const calledMethod = ctrl.serviceCalls[0].serviceMethod.toLowerCase();
      srv = services.find(s => s.method.toLowerCase() === calledMethod);
    }
    if (!srv) {
      srv = services.find(s => s.method.toLowerCase() === keyLower) || null;
    }

    results.push({
      key,
      frontendApi: fe,
      frontendCallers: callers,
      backendRoute: route,
      backendController: ctrl,
      backendService: srv,
    });
  }

  return results;
}

// -------------------------------------------------------------
// GENERIC FILE FUNCTION EXTRACTOR
// -------------------------------------------------------------

function getFileFunctions(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fileExists(abs)) return [];
  const content = fs.readFileSync(abs, 'utf8');
  const lines = content.split('\n');

  const patterns = [
    { re: /^\s*(?:public|private|protected)\s+(?:async\s+)?(\w+)\s*\(/, type: 'service-method' },
    { re: /^\s*public\s+(\w+)\s*=\s*(?:async\s*)?\(/, type: 'controller-handler' },
    { re: /^\s*async\s+(\w+)\s*\(/, type: 'async-method' },
    { re: /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/, type: 'function' },
    { re: /^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>/, type: 'const-arrow' },
    { re: /^\s*export\s+default\s+function\s+(\w+)/, type: 'react-page-component' },
  ];

  const functions = [];
  lines.forEach((line, idx) => {
    for (const p of patterns) {
      const m = line.match(p.re);
      if (m && m[1]) {
        functions.push({
          name: m[1],
          type: p.type,
          line: idx + 1,
          raw: line.trim(),
        });
        break;
      }
    }
  });

  return functions;
}

// -------------------------------------------------------------
// FILE IMPORT GRAPH PARSER (DEPTH 0, 1, 2)
// -------------------------------------------------------------

function tryResolve(baseDir, spec) {
  const candidates = [
    spec,
    spec + '.ts',
    spec + '.tsx',
    spec + '.js',
    spec + '.jsx',
    spec + '.json',
    path.join(spec, 'index.ts'),
    path.join(spec, 'index.tsx'),
    path.join(spec, 'index.js'),
  ];
  for (const c of candidates) {
    const abs = path.isAbsolute(c) ? c : path.join(baseDir, c);
    if (fileExists(abs)) return abs;
    if (fileExists(c)) return c;
  }
  return null;
}

function resolveImport(spec, fromFile) {
  const fromDir = path.dirname(fromFile);
  const isBackend = toPosix(fromFile).includes('backend/src');

  if (spec.startsWith('.')) {
    const abs = path.resolve(fromDir, spec);
    return tryResolve('', abs) || tryResolve(fromDir, spec);
  }

  if (spec.startsWith('@/')) {
    const rest = spec.slice(2);
    const abs = path.join(FRONTEND_ROOT, rest);
    const found = tryResolve('', abs);
    if (found) return found;
  }

  if (isBackend || spec.startsWith('@')) {
    if (spec === '@modules') return tryResolve('', path.join(BACKEND_ROOT, 'modules/index.ts'));
    if (spec.startsWith('@modules/')) return tryResolve('', path.join(BACKEND_ROOT, 'modules', spec.slice(9)));
    if (spec === '@config') return tryResolve('', path.join(BACKEND_ROOT, 'config/index.ts'));
    if (spec.startsWith('@config/')) return tryResolve('', path.join(BACKEND_ROOT, 'config', spec.slice(8)));
    if (spec === '@database') return tryResolve('', path.join(BACKEND_ROOT, 'database/index.ts'));
    if (spec.startsWith('@database/')) return tryResolve('', path.join(BACKEND_ROOT, 'database', spec.slice(10)));
    if (spec.startsWith('@dtos/')) return tryResolve('', path.join(BACKEND_ROOT, 'dtos', spec.slice(6)));
    if (spec.startsWith('@exceptions/')) return tryResolve('', path.join(BACKEND_ROOT, 'exceptions', spec.slice(12)));
    if (spec.startsWith('@interfaces/')) return tryResolve('', path.join(BACKEND_ROOT, 'interfaces', spec.slice(12)));
    if (spec.startsWith('@middlewares/')) return tryResolve('', path.join(BACKEND_ROOT, 'middlewares', spec.slice(13)));
    if (spec.startsWith('@utils/')) return tryResolve('', path.join(BACKEND_ROOT, 'utils', spec.slice(7)));

    if (spec.startsWith('@models/')) {
      const rest = spec.slice(8);
      for (const mod of ['auth', 'chat', ...DOMAIN_MODULES]) {
        const abs = path.join(BACKEND_ROOT, 'modules', mod, rest);
        const found = tryResolve('', abs);
        if (found) return found;
      }
    }
    if (spec.startsWith('@services/')) {
      const rest = spec.slice(10);
      for (const mod of ['auth', 'chat', ...DOMAIN_MODULES]) {
        const abs = path.join(BACKEND_ROOT, 'modules', mod, rest);
        const found = tryResolve('', abs);
        if (found) return found;
      }
    }

    for (const d of DOMAIN_MODULES) {
      if (spec.startsWith(d + '/')) {
        const abs = path.join(BACKEND_ROOT, 'modules', spec);
        const found = tryResolve('', abs);
        if (found) return found;
      }
    }
  }

  return null;
}

function parseImports(absPath) {
  let content = '';
  try {
    content = fs.readFileSync(absPath, 'utf8');
  } catch {
    return [];
  }
  const imports = new Set();
  const re1 = /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re1.exec(content)) !== null) imports.add(m[1].trim());
  const re2 = /import\s+['"]([^'"]+)['"]/g;
  while ((m = re2.exec(content)) !== null) imports.add(m[1].trim());
  const re3 = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = re3.exec(content)) !== null) imports.add(m[1].trim());

  return [...imports].filter(
    s =>
      !s.startsWith('react') &&
      !s.startsWith('next') &&
      !s.startsWith('@mui') &&
      !s.startsWith('@emotion') &&
      !s.startsWith('axios') &&
      !s.startsWith('express') &&
      !s.startsWith('mongoose') &&
      !s.startsWith('typedi') &&
      !s.startsWith('winston') &&
      !s.startsWith('jsonwebtoken') &&
      !s.startsWith('bcrypt') &&
      !s.startsWith('cookie-parser') &&
      !s.startsWith('cors') &&
      !s.startsWith('dotenv') &&
      !s.startsWith('helmet') &&
      !s.startsWith('hpp') &&
      !s.startsWith('morgan') &&
      !s.startsWith('multer') &&
      !s.startsWith('ioredis') &&
      !s.startsWith('node:') &&
      !s.startsWith('path') &&
      !s.startsWith('fs') &&
      !s.startsWith('crypto') &&
      !s.startsWith('stream') &&
      !s.startsWith('events')
  );
}

function sanitizeRoute(raw) {
  if (!raw) return '';
  let r = raw;
  r = r.replace(/^[A-Za-z]:[/\\]Program Files[/\\]Git/i, '');
  r = r.replace(/^\/[a-zA-Z]\/Program Files\/Git/i, '');
  r = toPosix(r);
  r = r.replace(/\?.*$/, '').replace(/#.*$/, '');
  if (!r.startsWith('/')) r = '/' + r;
  return r;
}

function resolvePageToFile(rawRoute) {
  const rClean = sanitizeRoute(rawRoute);
  let r = rClean.replace(/^\//, '');

  if (r === '' || r === '/') {
    const rootPage = path.join(ROOT, 'frontend/src/app/page.tsx');
    if (fileExists(rootPage)) return rootPage;
  }

  const appCandidates = [
    path.join(ROOT, `frontend/src/app/${r}/page.tsx`),
    path.join(ROOT, `frontend/src/app/${r}/page.ts`),
    path.join(ROOT, `frontend/src/app/${r}.tsx`),
    path.join(ROOT, `frontend/src/app/${r}.ts`),
    path.join(ROOT, `frontend/src/app/${r}/layout.tsx`),
  ];
  for (const c of appCandidates) {
    if (fileExists(c)) return c;
  }

  const routes = getAllBackendRoutes();
  const searchRoute = rClean.toLowerCase();
  for (const br of routes) {
    if (br.endpoint && (br.endpoint.toLowerCase() === searchRoute || ('/api/' + br.domain).toLowerCase() === searchRoute)) {
      return path.join(ROOT, br.routeFile);
    }
  }

  return null;
}

function findBestFileForFeature(rawKw) {
  const kw = rawKw.toLowerCase().replace(/^--?/, '').trim();
  const singular = kw.endsWith('ies')
    ? kw.slice(0, -3) + 'y'
    : kw.endsWith('es')
    ? kw.slice(0, -2)
    : kw.endsWith('s') && !kw.endsWith('ss')
    ? kw.slice(0, -1)
    : kw;

  const allFiles = [
    ...walkDir(path.join(ROOT, 'frontend/src/app'), f => f.endsWith('.tsx') || f.endsWith('.ts')),
    ...walkDir(path.join(ROOT, 'frontend/src/components'), f => f.endsWith('.tsx') || f.endsWith('.ts')),
    ...walkDir(path.join(ROOT, 'frontend/src/hooks'), f => f.endsWith('.ts') || f.endsWith('.tsx')),
    ...walkDir(path.join(ROOT, 'frontend/src/lib'), f => f.endsWith('.ts') || f.endsWith('.tsx')),
    ...walkDir(path.join(ROOT, 'frontend/src/theme'), f => f.endsWith('.ts') || f.endsWith('.tsx')),
    ...walkDir(path.join(ROOT, 'backend/src/modules'), f => f.endsWith('.ts')),
    ...walkDir(path.join(ROOT, 'backend/src/middlewares'), f => f.endsWith('.ts')),
  ];

  let best = null;
  let bestScore = -1;

  for (const abs of allFiles) {
    const rel = toRel(abs);
    const base = path.basename(rel).replace(/\.(tsx?|jsx?)$/, '').toLowerCase();
    const relLower = rel.toLowerCase();

    let score = 0;
    if (base === kw || base === singular) score += 120;
    else if (base === kw + '.service' || base === singular + '.service') score += 115;
    else if (base === kw + '.controller' || base === singular + '.controller') score += 110;
    else if (base === kw + '.route' || base === singular + '.route') score += 105;
    else if (base === kw + '.model' || base === singular + '.model') score += 100;
    else if (base.startsWith(kw) || base.startsWith(singular)) score += 80;
    else if (base.includes(kw) || base.includes(singular)) score += 60;
    else if (relLower.includes('/' + kw + '/') || relLower.includes('/' + singular + '/')) score += 50;
    else if (relLower.includes(kw) || relLower.includes(singular)) score += 30;

    if (score === 0) continue;

    if (kw === 'sse' && base.includes('sse')) score += 90;
    if (kw === 'device' && (base.includes('device') || relLower.includes('device'))) score += 90;
    if (kw === 'chat' && rel.includes('frontend/src/app/page.tsx')) score += 20;

    if (rel.includes('/components/')) score += 18;
    else if (rel.includes('/services/')) score += 18;
    else if (rel.includes('/routes/')) score += 15;
    else if (rel.includes('/controllers/')) score += 14;

    if (score > bestScore) {
      bestScore = score;
      best = abs;
    }
  }

  return best;
}

function detectDomain(relPath) {
  const lower = relPath.toLowerCase();
  for (const d of DOMAIN_MODULES) {
    if (lower.includes(`backend/src/modules/${d}/`)) return d;
  }
  if (lower.includes('/chat') || lower.includes('chatbox') || lower.includes('messagelist') || lower.includes('use_sse') || lower.includes('usesse')) {
    return 'chat';
  }
  if (lower.includes('/tool') || lower.includes('aisettings')) {
    return 'tools';
  }
  if (lower.includes('/admin') || lower.includes('/auth') || lower.includes('/login') || lower.includes('user.model')) {
    return 'auth';
  }
  if (lower.includes('/todo')) {
    return 'todos';
  }
  if (lower.includes('/setting')) {
    return 'settings';
  }
  if (lower.includes('/theme')) {
    return 'theme';
  }
  return 'core';
}

function detectRole(relPath) {
  if (relPath.endsWith('.route.ts')) return 'Backend route (Express)';
  if (relPath.endsWith('.controller.ts')) return 'Backend controller';
  if (relPath.endsWith('.service.ts')) {
    if (relPath.includes('sse.service')) return 'SSE broadcast service';
    return 'Backend service (TypeDI)';
  }
  if (relPath.endsWith('.model.ts')) return 'Mongoose model';
  if (relPath.includes('backend/src/middlewares/')) return 'Express middleware';
  if (relPath.includes('backend/src/interfaces/')) return 'TypeScript interface';
  if (relPath.includes('backend/src/dtos/')) return 'DTO / validation';
  if (relPath.includes('backend/src/config/')) return 'Configuration';
  if (relPath.includes('frontend/src/app/') && relPath.endsWith('page.tsx')) return 'Next.js 16 App Page';
  if (relPath.includes('frontend/src/app/') && relPath.endsWith('layout.tsx')) return 'Next.js 16 Root Layout';
  if (relPath.includes('frontend/src/components/')) return 'Feature UI component (MUI)';
  if (relPath.includes('frontend/src/hooks/')) return 'React hook';
  if (relPath.includes('frontend/src/lib/api.ts')) return 'Frontend API Client (fetch)';
  if (relPath.includes('frontend/src/lib/device.ts')) return 'Device Identity & Headers';
  if (relPath.includes('frontend/src/lib/constants.ts')) return 'Constants & Prompts';
  if (relPath.includes('frontend/src/theme/')) return 'MUI Theme Registry';
  return 'Source file';
}

function findCounterparts(relPath) {
  const isFrontend = relPath.startsWith('frontend/');
  const domain = detectDomain(relPath);

  if (isFrontend) {
    const backendFiles = [];
    if (domain === 'chat') {
      backendFiles.push(
        'backend/src/modules/chat/chat.service.ts',
        'backend/src/modules/chat/chat.controller.ts',
        'backend/src/modules/chat/chat.route.ts',
        'backend/src/modules/chat/sse.service.ts',
        'backend/src/modules/chat/message.model.ts'
      );
    } else if (domain === 'tools') {
      backendFiles.push(
        'backend/src/modules/tools/tool.service.ts',
        'backend/src/modules/tools/tool.controller.ts',
        'backend/src/modules/tools/tool.route.ts',
        'backend/src/modules/tools/tool.model.ts'
      );
    } else if (domain === 'auth') {
      backendFiles.push(
        'backend/src/modules/auth/auth.service.ts',
        'backend/src/modules/auth/auth.controller.ts',
        'backend/src/modules/auth/auth.route.ts',
        'backend/src/modules/auth/user.model.ts'
      );
    } else if (domain === 'todos') {
      backendFiles.push(
        'backend/src/modules/todos/todo.service.ts',
        'backend/src/modules/todos/todo.controller.ts',
        'backend/src/modules/todos/todo.route.ts',
        'backend/src/modules/todos/todo.model.ts'
      );
    } else if (domain === 'settings') {
      backendFiles.push(
        'backend/src/modules/settings/setting.service.ts',
        'backend/src/modules/settings/setting.controller.ts',
        'backend/src/modules/settings/setting.route.ts',
        'backend/src/modules/settings/setting.model.ts'
      );
    }
    return backendFiles.filter(p => fileExists(path.join(ROOT, p)));
  } else {
    const frontendFiles = [];
    if (domain === 'chat') {
      frontendFiles.push(
        'frontend/src/app/page.tsx',
        'frontend/src/components/ChatBox.tsx',
        'frontend/src/components/MessageList.tsx',
        'frontend/src/hooks/useSSE.ts',
        'frontend/src/lib/api.ts'
      );
    } else if (domain === 'tools') {
      frontendFiles.push(
        'frontend/src/app/tools/page.tsx',
        'frontend/src/components/AISettingsModal.tsx',
        'frontend/src/lib/api.ts'
      );
    } else if (domain === 'auth') {
      frontendFiles.push(
        'frontend/src/app/admin/page.tsx',
        'frontend/src/app/login/page.tsx',
        'frontend/src/lib/api.ts'
      );
    } else if (domain === 'todos') {
      frontendFiles.push(
        'frontend/src/components/TodoView.tsx',
        'frontend/src/lib/api.ts'
      );
    } else if (domain === 'settings') {
      frontendFiles.push(
        'frontend/src/components/AISettingsModal.tsx',
        'frontend/src/lib/api.ts'
      );
    }
    return frontendFiles.filter(p => fileExists(path.join(ROOT, p)));
  }
}

function buildGraph(entryAbs, maxDepth = 2) {
  const visited = new Set();
  const level0 = [toRel(entryAbs)];
  const level1 = [];
  const level2 = [];
  const levels = [];
  const edges = [];

  visited.add(entryAbs);
  let frontier = [entryAbs];

  for (let d = 0; d < maxDepth; d++) {
    const nextFrontier = [];
    const levelFiles = [];
    for (const cur of frontier) {
      const specs = parseImports(cur);
      for (const spec of specs) {
        const resolved = resolveImport(spec, cur);
        if (!resolved) continue;
        const rel = toRel(resolved);
        if (!rel.startsWith('frontend/src/') && !rel.startsWith('backend/src/')) continue;
        edges.push({ from: toRel(cur), to: rel, spec });
        if (!visited.has(resolved)) {
          visited.add(resolved);
          nextFrontier.push(resolved);
          levelFiles.push(rel);
          if (d === 0) level1.push(rel);
          else if (d === 1) level2.push(rel);
        }
      }
    }
    if (levelFiles.length) levels.push(levelFiles);
    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }

  return {
    entry: toRel(entryAbs),
    level0,
    level1,
    level2,
    levels,
    edges,
    visited: [...visited].map(p => toRel(p)),
  };
}

// -------------------------------------------------------------
// CLI EXECUTION
// -------------------------------------------------------------

const args = process.argv.slice(2);
let fileArg = null,
  pageArg = null,
  featureArg = null,
  fnArg = null,
  callArg = null,
  showFunctions = false,
  depth = 2,
  json = false;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--file') fileArg = args[++i];
  else if (a === '--page' || a === '--route') pageArg = args[++i];
  else if (a === '--feature') featureArg = args[++i];
  else if (a === '--fn' || a === '--function') fnArg = args[++i];
  else if (a === '--call' || a === '--endpoint') callArg = args[++i];
  else if (a === '--functions' || a === '--methods') showFunctions = true;
  else if (a === '--depth') depth = parseInt(args[++i], 10);
  else if (a === '--json') json = true;
  else if (a === '--help' || a === '-h') {
    printHelp();
    process.exit(0);
  } else if (a.startsWith('/') && !pageArg && !callArg) {
    if (a.startsWith('/api')) callArg = a;
    else pageArg = a;
  } else if (!a.startsWith('-') && !fileArg && !pageArg && !featureArg && !fnArg && !callArg) {
    if (a.includes('/') || a.endsWith('.ts') || a.endsWith('.tsx')) fileArg = a;
    else featureArg = a;
  }
}

// -------------------------------------------------------------
// MODE 1: FUNCTION & CALL CHAIN TRACER (--fn or --call)
// -------------------------------------------------------------
if (fnArg || callArg) {
  const query = fnArg || callArg;
  const traces = traceFunctionChain(query);

  if (traces.length === 0) {
    console.error(`No function or route found matching "${query}".`);
    process.exit(1);
  }

  if (json) {
    console.log(JSON.stringify({ query, traces }, null, 2));
    process.exit(0);
  }

  console.log(`\n======================================================================`);
  console.log(`FUNCTION RELATIONSHIP & DATA FLOW TRACE for: "${query}"`);
  console.log(`======================================================================\n`);

  traces.forEach((t, idx) => {
    console.log(`[Trace #${idx + 1}] Target: ${t.key}`);

    // Step 1: Frontend API
    if (t.frontendApi) {
      console.log(`\n  1. FRONTEND API METHOD:`);
      console.log(`     - File: ${t.frontendApi.apiFile}:${t.frontendApi.startLine}-${t.frontendApi.endLine}`);
      console.log(`     - Method: api.${t.frontendApi.methodName}()`);
      console.log(`     - Calls: ${t.frontendApi.httpMethod} ${t.frontendApi.endpoint || 'N/A'}`);
    } else {
      console.log(`\n  1. FRONTEND API: (No direct wrapper in frontend/src/lib/api.ts)`);
    }

    // Step 2: Frontend Callers in UI
    if (t.frontendCallers && t.frontendCallers.length > 0) {
      console.log(`\n  2. FRONTEND UI CALLERS (${t.frontendCallers.length} locations):`);
      t.frontendCallers.forEach(c => {
        console.log(`     - ${c.file}:${c.line}  ->  ${c.code}`);
      });
    }

    // Step 3: Backend Route
    if (t.backendRoute) {
      console.log(`\n  3. BACKEND ROUTE REGISTRATION:`);
      console.log(`     - File: ${t.backendRoute.routeFile}:${t.backendRoute.line}`);
      console.log(`     - Route: ${t.backendRoute.httpMethod} ${t.backendRoute.endpoint}`);
      console.log(`     - Handler: ${t.backendRoute.controllerVar || 'Controller'}.${t.backendRoute.handler}`);
    } else {
      console.log(`\n  3. BACKEND ROUTE: (No explicit route matched)`);
    }

    // Step 4: Backend Controller
    if (t.backendController) {
      console.log(`\n  4. BACKEND CONTROLLER (Request Decoder):`);
      console.log(`     - File: ${t.backendController.controllerFile}:${t.backendController.startLine}-${t.backendController.endLine}`);
      console.log(`     - Handler: ${t.backendController.handler}`);
      if (t.backendController.serviceCalls.length > 0) {
        t.backendController.serviceCalls.forEach(sc => {
          console.log(`       -> Delegates to: this.${sc.serviceVar}.${sc.serviceMethod}() (line ${sc.line})`);
        });
      }
    } else {
      console.log(`\n  4. BACKEND CONTROLLER: (None matched)`);
    }

    // Step 5: Backend Service (Data Provider)
    if (t.backendService) {
      console.log(`\n  5. BACKEND SERVICE (Data Provider Function):`);
      console.log(`     - File: ${t.backendService.serviceFile}:${t.backendService.startLine}-${t.backendService.endLine}`);
      console.log(`     - Service Method: ${t.backendService.method}()`);
      if (t.backendService.modelQueries.length > 0) {
        console.log(`       -> Database / Model Operations:`);
        t.backendService.modelQueries.forEach(mq => {
          console.log(`          * line ${mq.line}: ${mq.raw}`);
        });
      }
    } else {
      console.log(`\n  5. BACKEND SERVICE: (None matched)`);
    }

    console.log(`\n----------------------------------------------------------------------`);
  });

  process.exit(0);
}

// -------------------------------------------------------------
// MODE 2: FILE & FEATURE RELATIONSHIP GRAPH
// -------------------------------------------------------------

let entryAbs = null;
let entryRel = null;
let routeForDisplay = null;

if (fileArg) {
  const cand = path.isAbsolute(fileArg) ? fileArg : path.join(ROOT, fileArg);
  if (!fileExists(cand)) {
    console.error(`File not found: ${fileArg}`);
    process.exit(1);
  }
  entryAbs = cand;
  entryRel = toRel(cand);
} else if (pageArg) {
  routeForDisplay = sanitizeRoute(pageArg);
  const resolved = resolvePageToFile(pageArg);
  if (!resolved) {
    console.error(`No page or backend route file found for route "${pageArg}".`);
    process.exit(1);
  }
  entryAbs = resolved;
  entryRel = toRel(resolved);
} else if (featureArg) {
  const found = findBestFileForFeature(featureArg);
  if (!found) {
    console.error(`No file found for feature "${featureArg}" across frontend or backend.`);
    process.exit(1);
  }
  entryAbs = found;
  entryRel = toRel(found);
} else {
  printHelp();
  process.exit(0);
}

if (isNaN(depth) || depth < 0) depth = 0;
if (depth > 3) depth = 3;

const graph = buildGraph(entryAbs, depth);
const entryLines = lineCount(entryAbs);
const entryDomain = detectDomain(entryRel);
const entryRole = detectRole(entryRel);
const counterparts = findCounterparts(entryRel);
const fileFunctions = showFunctions ? getFileFunctions(entryRel) : [];

function estTokensForFileList(nFiles) {
  return nFiles * 18 + 120;
}
const totalRelated = graph.visited.length - 1;
const estTok = estTokensForFileList(graph.visited.length);

if (json) {
  const out = {
    target: {
      file: entryRel,
      lines: entryLines,
      route: routeForDisplay || null,
      domain: entryDomain,
      role: entryRole,
      functions: fileFunctions,
    },
    depth,
    domain: entryDomain,
    level0: graph.level0,
    level1: graph.level1,
    level2: graph.level2,
    levels: [graph.level0, ...graph.levels],
    edges: graph.edges,
    visited: graph.visited,
    counterparts,
    stats: {
      totalFiles: graph.visited.length,
      relatedFiles: totalRelated,
      estTokens: estTok,
    },
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

// ---- CLI Pretty Print ----
console.log(`TARGET: ${entryRel} (${entryLines} lines)`);
console.log(`Domain: ${entryDomain}  |  Role: ${entryRole || 'Source file'}${routeForDisplay ? `  |  Route: ${routeForDisplay}` : ''}`);
console.log(`Depth: ${depth}  |  Related files: ${totalRelated}  |  Est tokens: ~${estTok}`);

// LEVEL 0
console.log(`\nLEVEL 0 --- Entry Target (1 file):`);
console.log(`  - ${entryRel} (${entryLines} lines) --- ${entryRole || 'Entry point'} [${entryDomain}]`);
if (counterparts.length > 0) {
  const label = entryRel.startsWith('frontend/') ? 'Connected backend' : 'Connected frontend';
  console.log(`      -> ${label}: ${counterparts.join(', ')}`);
}

// Show functions inside TARGET if requested
if (showFunctions && fileFunctions.length > 0) {
  console.log(`\nFUNCTIONS IN TARGET (${fileFunctions.length} functions):`);
  fileFunctions.forEach(fn => {
    console.log(`  - line ${fn.line} [${fn.type}]: ${fn.name}  ->  ${fn.raw}`);
  });
}

// LEVEL 1
if (depth >= 1) {
  console.log(`\nLEVEL 1 --- Direct Imports of Level 0 (${graph.level1.length} files):`);
  if (graph.level1.length === 0) {
    console.log('  (No direct project imports found)');
  } else {
    for (const rel of graph.level1) {
      const abs = path.join(ROOT, rel);
      const lc = lineCount(abs);
      const role = detectRole(rel);
      const dom = detectDomain(rel);
      console.log(`  - ${rel} (${lc} lines) --- ${role} [${dom}]`);
    }
  }
}

// LEVEL 2
if (depth >= 2) {
  console.log(`\nLEVEL 2 --- Direct Imports of Level 1 (${graph.level2.length} files):`);
  if (graph.level2.length === 0) {
    console.log('  (No transitive imports found)');
  } else {
    for (const rel of graph.level2) {
      const abs = path.join(ROOT, rel);
      const lc = lineCount(abs);
      const role = detectRole(rel);
      const dom = detectDomain(rel);
      console.log(`  - ${rel} (${lc} lines) --- ${role} [${dom}]`);
    }
  }
}

// Flat visited summary
if (graph.visited.length > 1) {
  console.log(`\nALL RELATED (flat, ${graph.visited.length} files incl. target):`);
  for (const rel of graph.visited) {
    const marker = rel === entryRel ? '=> TARGET' : '   ';
    console.log(`  ${marker} ${rel}`);
  }
}

console.log(`\nToken footprint: ~${estTok} tokens (95%+ savings compared to full directory search)`);
