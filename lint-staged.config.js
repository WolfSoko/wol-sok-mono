import path from 'node:path';

export default {
  '*': (stagedFiles) => {
    const relativeFilePaths = stagedFiles
      .map((file) => path.relative(process.cwd(), file))
      .join(',');

    const formatCommand = `npx nx format:write --files="${relativeFilePaths}"`;
    const lintCommand = `npx nx affected -t="lint" --output-style=static --fix --files="${relativeFilePaths}"`;

    return [formatCommand, lintCommand];
  },
};
