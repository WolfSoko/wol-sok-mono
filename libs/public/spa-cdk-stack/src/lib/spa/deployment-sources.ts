import { AssetStaging } from 'aws-cdk-lib';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import { BucketDeployment } from 'aws-cdk-lib/aws-s3-deployment';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The paths below one staged source folder, with `/` between segments. */
interface SourceTree {
  files: Set<string>;
  folders: Set<string>;
}

/**
 * Throws when one source of the deployment holds a file at a path where
 * another holds a folder, such as `Source.data('blog', …)` beside
 * `Source.data('blog/first-post', …)`. The deployment's Lambda unpacks all
 * its sources into one folder, so such a pair would fail only at deploy time
 * with `Not a directory` and roll the stack back.
 *
 * It reads the staged folders of the local assets the sources bound as
 * children of the deployment (`Source.asset`, `Source.data`,
 * `Source.jsonData`), after their excludes. Zip files, sources from a bucket
 * and staged paths that do not exist are not checked. A deployment with one
 * source is not read at all.
 */
export function assertNoFileIsAnotherSourcesFolder(
  deployment: BucketDeployment
): void {
  const stagedFolders = deployment.node.children
    .filter((child): child is Asset => child instanceof Asset)
    .map((asset) => stagedFolderOf(asset))
    .filter((folder): folder is string => folder !== undefined);
  if (stagedFolders.length < 2) {
    return;
  }
  const trees = stagedFolders.map((folder) => readTree(folder));
  for (const [index, { files }] of trees.entries()) {
    const others = trees.filter((_, other) => other !== index);
    const clash = [...files].find((file) =>
      others.some(({ folders }) => folders.has(file))
    );
    if (clash !== undefined) {
      throw new Error(
        `"${clash}" is a file in one source and a folder in another of the ` +
          'same deployment. A BucketDeployment unpacks all its sources into ' +
          'one folder, so add them in separate addExtraAssets calls.'
      );
    }
  }
}

function stagedFolderOf(asset: Asset): string | undefined {
  const staging = asset.node.tryFindChild('Stage');
  if (!(staging instanceof AssetStaging)) {
    return undefined;
  }
  const folder = staging.absoluteStagedPath;
  return existsSync(folder) && statSync(folder).isDirectory()
    ? folder
    : undefined;
}

function readTree(root: string): SourceTree {
  const tree: SourceTree = { files: new Set(), folders: new Set() };
  const visit = (prefix: string): void => {
    for (const entry of readdirSync(join(root, prefix), {
      withFileTypes: true,
    })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        tree.folders.add(path);
        visit(path);
      } else {
        tree.files.add(path);
      }
    }
  };
  visit('');
  return tree;
}
