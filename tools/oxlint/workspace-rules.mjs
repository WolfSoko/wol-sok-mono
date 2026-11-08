/**
 * Workspace rules for Oxlint, loaded as a JS plugin from `.oxlintrc.json`
 * (the `@nx/oxlint` plugin declares this file as an input of every `lint`
 * task, so a change here reruns them).
 */

const BOUNDARY_RULE = 'enforce-module-boundaries';
const VERSION_FILE = 'version.json';
const READ_FUNCTION = /^read/;
const DISABLE_DIRECTIVE =
  /^\s*(?:eslint|oxlint)-disable(?:-next-line|-line)?\b/;

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
    return node.quasis.map((quasi) => quasi.value.cooked ?? '').join('');
  }
  return undefined;
}

/** Whether a path's last segment is exactly the workspace version file. */
function namesVersionFile(path) {
  return path?.split(/[\\/]/).at(-1) === VERSION_FILE;
}

/**
 * Whether a path expression reaches a read call within its own expression:
 * up through call arguments (`join(…)`), template literals and `+`, until a
 * call whose function name starts with `read`, or `require`.
 */
function reachesReadCall(node) {
  let child = node;
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'CallExpression') {
      if (!parent.arguments.includes(child)) {
        return false;
      }
      if (isReadCallee(parent.callee)) {
        return true;
      }
    } else if (!PATH_EXPRESSIONS.has(parent.type)) {
      return false;
    }
    child = parent;
  }
  return false;
}

/** Expressions a path may pass through on its way to the read call. */
const PATH_EXPRESSIONS = new Set([
  'TemplateLiteral',
  'BinaryExpression',
  'TSAsExpression',
  'ParenthesizedExpression',
]);

/** `readFileSync(…)`, `fs.promises.readFile(…)`, `readJson(…)`, `require(…)`. */
function isReadCallee(callee) {
  const name =
    callee.type === 'MemberExpression' ? callee.property.name : callee.name;
  return name === 'require' || READ_FUNCTION.test(name ?? '');
}

export default {
  meta: { name: 'wolsok' },
  rules: {
    'no-boundary-disable': noBoundaryDisable,
    'no-version-json-read': noVersionJsonRead,
  },
};
