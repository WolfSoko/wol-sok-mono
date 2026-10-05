// This version reflects the latest git tag at build time. The value is written
// into version-tag.generated.ts by the `generate-version` target, which the
// build depends on.
import { versionTag } from './version-tag.generated';

export const version = versionTag;
