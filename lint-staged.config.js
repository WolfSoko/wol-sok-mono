import path from 'node:path';

export default {
  '*': (stagedFiles) => {
    const relativeFilePaths = stagedFiles
      .map((file) => path.relative(process.cwd(), file))
      .join(',');

    const formatCommand = `npx nx format:write --files="${relativeFilePaths}"`;
    const syncCommand = `npx nx sync:check`;
    const lintTestCommand = `npx nx affected -t="lint,test" --output-style=static --fix --files="${relativeFilePaths}"`;

    return [syncCommand, formatCommand, lintTestCommand];
  },
};
