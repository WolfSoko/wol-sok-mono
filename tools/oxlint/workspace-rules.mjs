/**
 * Workspace rules for Oxlint, loaded as a JS plugin from `.oxlintrc.json`
 * (the `@nx/oxlint` plugin declares this file as an input of every `lint`
 * task, so a change here reruns them).
 */

const BOUNDARY_RULE = 'enforce-module-boundaries';
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

export default {
  meta: { name: 'wolsok' },
  rules: { 'no-boundary-disable': noBoundaryDisable },
};
