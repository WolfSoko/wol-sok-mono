/**
 * Workspace rules for Oxlint, loaded as a JS plugin from `.oxlintrc.json`
 * (the `@nx/oxlint` plugin declares this file as an input of every `lint`
 * task, so a change here reruns them).
 */

const BOUNDARY_RULE = 'enforce-module-boundaries';
const VERSION_FILE = 'version.json';
/** `read`, `readFile`, `readJson`: not `readme` or `ready`. */
const READ_FUNCTION = /^read(?![a-z])/;
/** Expressions a path may pass through on its way to the read call. */
const PATH_EXPRESSIONS = new Set([
  'TemplateLiteral',
  'BinaryExpression',
  'LogicalExpression',
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
]);
/** Stands for a template's expressions, so `version.json${ext}` names no file. */
const EXPRESSION_PLACEHOLDER = '\0';
const DISABLE_DIRECTIVE =
  /^\s*(?:eslint|oxlint)-disable(?:-next-line|-line)?\b/;
/** A workspace lib's testing entry: `@wolsok/<lib>/testing` and below it. */
const WORKSPACE_TESTING_ENTRY = /^@wolsok\/[^/]+\/testing(?:\/|$)/;
/** A relative path through a `testing` folder or to a `testing` module. */
const RELATIVE_TESTING_PATH =
  /^\.{1,2}\/(?:.*\/)?testing(?:\.[cm]?[jt]s)?(?:\/|$)/;
/**
 * Test code under a project's `src/` by its file name: specs, emulator
 * specs, Cypress component tests, mocks, Jest's setup, a lib's `testing.ts`
 * entry and everything below a `testing/` folder.
 */
const TEST_FILE =
  /(?:\.(?:spec|test|emulator|cy|mock)\.[cm]?[jt]sx?|(?:^|\/)(?:test-setup|testing)\.[cm]?[jt]s)$|(?:^|\/)testing\//;

/**
 * Boundaries are configured, not silenced: an import the tag rules refuse
 * moves behind a lib's public API (as `version.json` did into
 * `@wolsok/utils-version`), and a deliberate exception goes into
 * `.oxlintrc.json` (`allow`, or an override for the files it concerns), where
 * it stays visible in one place.
 */
const noBoundaryDisable = {
  meta: {
    type: 'problem',
    docs: {
      description: `Forbids disable comments for @nx/${BOUNDARY_RULE}.`,
    },
    messages: {
      disabled: `Do not disable @nx/${BOUNDARY_RULE} inline: import through the lib's path alias, or record the exception in .oxlintrc.json.`,
    },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (isBoundaryDisable(comment.value)) {
            context.report({ loc: comment.loc, messageId: 'disabled' });
          }
        }
      },
    };
  },
};

/** Whether a comment's text disables the boundary rule. */
function isBoundaryDisable(text) {
  return DISABLE_DIRECTIVE.test(text) && text.includes(BOUNDARY_RULE);
}

/**
 * The workspace version is read through `@wolsok/utils-version`, which
 * declares `version.json` as an Nx input: a file that reads it itself is no
 * dependent of that input, so a release may leave its cached tasks as they
 * were. The boundary rule only sees imports; this rule also sees reads
 * (`readFileSync(join(root, 'version.json'))`). It reports a string naming
 * the file only where it is read, so a write such as the CDK stack's
 * `Source.jsonData('version.json', …)` stays allowed. The lib itself is
 * exempt through an override in `.oxlintrc.json`.
 */
const noVersionJsonRead = {
  meta: {
    type: 'problem',
    docs: {
      description: `Forbids reading ${VERSION_FILE} outside @wolsok/utils-version.`,
    },
    messages: {
      read: `Do not read ${VERSION_FILE} directly: use WORKSPACE_VERSION or releaseName() from @wolsok/utils-version, which declares the file as an Nx input.`,
    },
    schema: [],
  },
  create(context) {
    const reportModuleSource = (node) => {
      if (node.source && namesVersionFile(staticText(node.source))) {
        context.report({ node: node.source, messageId: 'read' });
      }
    };
    const reportRead = (node) => {
      if (namesVersionFile(staticText(node)) && reachesReadCall(node)) {
        context.report({ node, messageId: 'read' });
      }
    };
    return {
      ImportDeclaration: reportModuleSource,
      ExportNamedDeclaration: reportModuleSource,
      ExportAllDeclaration: reportModuleSource,
      ImportExpression: reportModuleSource,
      Literal: reportRead,
      TemplateLiteral: reportRead,
    };
  },
};

/** The text of a string literal, or the static parts of a template literal. */
function staticText(node) {
  if (node.type === 'Literal') {
    return typeof node.value === 'string' ? node.value : undefined;
  }
  if (node.type === 'TemplateLiteral') {
    return node.quasis
      .map((quasi) => quasi.value.cooked ?? '')
      .join(EXPRESSION_PLACEHOLDER);
  }
  return undefined;
}

/** Whether a path's last segment is exactly the workspace version file. */
function namesVersionFile(path) {
  return path?.split(/[\\/]/).at(-1) === VERSION_FILE;
}

/**
 * Whether a path expression reaches a read call within its own expression:
 * up through call and `new` arguments (`join(…)`, `new URL(…)`), templates,
 * operators and type assertions, until a
 * call whose function name starts with `read`, or `require`.
 */
function reachesReadCall(node) {
  let child = node;
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'CallExpression' || parent.type === 'NewExpression') {
      if (!parent.arguments.includes(child)) {
        return false;
      }
      if (parent.type === 'CallExpression' && isReadCallee(parent.callee)) {
        return true;
      }
    } else if (parent.type === 'ConditionalExpression') {
      // `existsSync(path) ? … : …` only tests the path; the branches pass on.
      if (parent.test === child) {
        return false;
      }
    } else if (!PATH_EXPRESSIONS.has(parent.type)) {
      return false;
    }
    child = parent;
  }
  return false;
}

/** `readFileSync(…)`, `fs.promises.readFile(…)`, `readJson(…)`, `require(…)`. */
function isReadCallee(callee) {
  const name =
    callee.type === 'MemberExpression' ? propertyName(callee) : callee.name;
  return name === 'require' || READ_FUNCTION.test(name ?? '');
}

/** `fs.readFile` and `fs['readFile']` alike. */
function propertyName(member) {
  return member.computed ? staticText(member.property) : member.property.name;
}

/**
 * The `/testing` entries and `testing/` folders hold fakes that call
 * `jest.fn` or `vi.fn` at module load: pulled into a production chunk, they
 * break it at runtime. The boundary rule cannot see this, since it counts
 * `<lib>/testing` as `<lib>`. Enabled for production sources (`apps/*\/src`,
 * `libs/**\/src`) by an override in `.oxlintrc.json`; test files there are
 * recognised by their name (`TEST_FILE`).
 */
const noTestingImport = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Forbids importing test-only code into production sources.',
    },
    messages: {
      testing:
        'Production code must not import test-only code ({{source}}): move what it needs out of the testing entry, or import it from a spec.',
    },
    schema: [],
  },
  create(context) {
    if (TEST_FILE.test(context.filename.replaceAll('\\', '/'))) {
      return {};
    }
    const report = (sourceNode) => {
      const source = staticText(sourceNode);
      if (source !== undefined && isTestingModule(source)) {
        context.report({
          node: sourceNode,
          messageId: 'testing',
          data: { source },
        });
      }
    };
    const reportModuleSource = (node) => {
      if (node.source) {
        report(node.source);
      }
    };
    return {
      ImportDeclaration: reportModuleSource,
      ExportNamedDeclaration: reportModuleSource,
      ExportAllDeclaration: reportModuleSource,
      ImportExpression: reportModuleSource,
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require'
        ) {
          const [argument] = node.arguments;
          if (argument) {
            report(argument);
          }
        }
      },
    };
  },
};

/** Whether a module specifier names the workspace's test-only code. */
function isTestingModule(source) {
  return (
    WORKSPACE_TESTING_ENTRY.test(source) || RELATIVE_TESTING_PATH.test(source)
  );
}

export default {
  meta: { name: 'wolsok' },
  rules: {
    'no-boundary-disable': noBoundaryDisable,
    'no-version-json-read': noVersionJsonRead,
    'no-testing-import': noTestingImport,
  },
};
