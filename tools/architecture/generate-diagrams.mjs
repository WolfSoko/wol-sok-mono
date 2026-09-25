#!/usr/bin/env node
/**
 * Generates the architecture diagrams in docs/architecture/README.md from the
 * Nx project graph.
 *
 *   npm run arch:diagrams            # regenerate the file
 *   npm run arch:diagrams -- --check # exit 1 if the file is out of date
 *
 * The output is deterministic (no timestamps), so the file only changes when
 * the architecture does. The weekly architecture routine regenerates it and
 * links it from the pinned architecture issue.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT_FILE = join(ROOT, 'docs/architecture/README.md');
const CHECK = process.argv.includes('--check');

// Order matters: the first matching group wins.
const GROUPS = [
  {
    id: 'infra',
    label: 'Infrastructure (CDK)',
    match: (p) => p.tags.includes('infra'),
  },
  {
    id: 'apps',
    label: 'Apps',
    match: (p) => p.type === 'app' || p.type === 'e2e',
  },
  {
    id: 'public',
    label: 'libs/public (published)',
    match: (p) => p.root.startsWith('libs/public/'),
  },
  {
    id: 'features',
    label: 'libs/features',
    match: (p) => p.root.startsWith('libs/features/'),
  },
  {
    id: 'shared',
    label: 'libs/shared',
    match: (p) => p.root.startsWith('libs/shared/'),
  },
  {
    id: 'utils',
    label: 'libs/utils',
    match: (p) => p.root.startsWith('libs/utils/'),
  },
  { id: 'other', label: 'libs (other)', match: () => true },
];

function readProjectGraph() {
  const dir = mkdtempSync(join(tmpdir(), 'nx-graph-'));
  const file = join(dir, 'graph.json');
  try {
    execFileSync('npx', ['nx', 'graph', `--file=${file}`], {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'inherit'],
      env: { ...process.env, NX_DAEMON: 'false' },
    });
    return JSON.parse(readFileSync(file, 'utf8')).graph;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function readDepConstraints() {
  const config = JSON.parse(readFileSync(join(ROOT, '.oxlintrc.json'), 'utf8'));
  const rule = config.rules?.['@nx/enforce-module-boundaries'];
  return (Array.isArray(rule) ? rule[1]?.depConstraints : undefined) ?? [];
}

function readFederationRemotes() {
  const manifest = join(
    ROOT,
    'apps/angular-examples/src/assets/federation.manifest.json'
  );
  return Object.keys(JSON.parse(readFileSync(manifest, 'utf8'))).sort(byText);
}

const byText = (a, b) => a.localeCompare(b);
const id = (name) => name.replace(/[^a-zA-Z0-9_]/g, '_');

function buildModel(graph) {
  const projects = Object.values(graph.nodes)
    // Skip the workspace root package.
    .filter((n) => n.data.root !== '.')
    .map((n) => ({
      name: n.name,
      type: n.type,
      root: n.data.root,
      // npm:* tags are inferred from package.json keywords, not boundary tags.
      tags: (n.data.tags ?? [])
        .filter((t) => !t.startsWith('npm:'))
        .sort(byText),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const names = new Set(projects.map((p) => p.name));

  const edges = [];
  for (const [source, deps] of Object.entries(graph.dependencies)) {
    if (!names.has(source)) continue;
    for (const dep of deps) {
      if (names.has(dep.target) && dep.target !== source) {
        edges.push({ source, target: dep.target, type: dep.type });
      }
    }
  }
  // Collapse duplicate edges (static + dynamic between the same pair).
  const unique = new Map();
  for (const e of edges) {
    const key = `${e.source}->${e.target}`;
    const prev = unique.get(key);
    if (!prev || e.type === 'static') unique.set(key, e);
  }
  const sortedEdges = [...unique.values()].sort(
    (a, b) =>
      a.source.localeCompare(b.source) || a.target.localeCompare(b.target)
  );

  for (const p of projects) {
    p.group = GROUPS.find((g) => g.match(p)).id;
    p.out = sortedEdges.filter((e) => e.source === p.name).length;
    p.in = sortedEdges.filter((e) => e.target === p.name).length;
    p.instability =
      p.in + p.out === 0 ? null : Number((p.out / (p.in + p.out)).toFixed(2));
  }
  return { projects, edges: sortedEdges };
}

function findCycles(projects, edges) {
  const adj = new Map(projects.map((p) => [p.name, []]));
  for (const e of edges) adj.get(e.source).push(e.target);
  // Tarjan's strongly connected components.
  let index = 0;
  const stack = [];
  const meta = new Map();
  const sccs = [];
  const visit = (v) => {
    meta.set(v, { index, low: index, onStack: true });
    index++;
    stack.push(v);
    for (const w of adj.get(v)) {
      if (!meta.has(w)) {
        visit(w);
        meta.get(v).low = Math.min(meta.get(v).low, meta.get(w).low);
      } else if (meta.get(w).onStack) {
        meta.get(v).low = Math.min(meta.get(v).low, meta.get(w).index);
      }
    }
    if (meta.get(v).low === meta.get(v).index) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        meta.get(w).onStack = false;
        scc.push(w);
      } while (w !== v);
      if (scc.length > 1) sccs.push(scc.sort(byText));
    }
  };
  for (const p of projects) if (!meta.has(p.name)) visit(p.name);
  return sccs;
}

function findBoundaryViolations(projects, edges, constraints) {
  const byName = new Map(projects.map((p) => [p.name, p]));
  const violations = [];
  // Implicit dependencies (e.g. a CDK stack deploying an app) are not imports,
  // so the lint rule does not check them either.
  for (const e of edges.filter((edge) => edge.type !== 'implicit')) {
    const source = byName.get(e.source);
    const target = byName.get(e.target);
    for (const c of constraints) {
      if (!c.sourceTag || !source.tags.includes(c.sourceTag)) continue;
      const allowed = c.onlyDependOnLibsWithTags ?? [];
      if (!target.tags.some((t) => allowed.includes(t))) {
        violations.push({ ...e, sourceTag: c.sourceTag, allowed });
      }
    }
  }
  return violations;
}

function projectGraphMermaid(projects, edges) {
  const lines = ['```mermaid', 'flowchart LR'];
  for (const g of GROUPS) {
    const members = projects.filter((p) => p.group === g.id);
    if (!members.length) continue;
    lines.push(`  subgraph ${g.id}["${g.label}"]`);
    for (const p of members) lines.push(`    ${id(p.name)}["${p.name}"]`);
    lines.push('  end');
  }
  for (const e of edges) {
    const arrow =
      e.type === 'dynamic' ? '-.->' : e.type === 'implicit' ? '==>' : '-->';
    lines.push(`  ${id(e.source)} ${arrow} ${id(e.target)}`);
  }
  lines.push('```');
  return lines.join('\n');
}

function layerMermaid(constraints) {
  const lines = ['```mermaid', 'flowchart TD'];
  const tags = new Set();
  for (const c of constraints) {
    tags.add(c.sourceTag);
    for (const t of c.onlyDependOnLibsWithTags ?? []) tags.add(t);
  }
  for (const t of [...tags].sort(byText)) lines.push(`  ${id(t)}(["${t}"])`);
  for (const c of constraints) {
    for (const t of c.onlyDependOnLibsWithTags ?? []) {
      if (t !== c.sourceTag) lines.push(`  ${id(c.sourceTag)} --> ${id(t)}`);
    }
  }
  lines.push('```');
  return lines.join('\n');
}

function groupMermaid(projects, edges) {
  const byName = new Map(projects.map((p) => [p.name, p]));
  const counts = new Map();
  for (const e of edges) {
    const from = byName.get(e.source).group;
    const to = byName.get(e.target).group;
    if (from === to) continue;
    const key = `${from}->${to}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const lines = ['```mermaid', 'flowchart TD'];
  for (const g of GROUPS) {
    const n = projects.filter((p) => p.group === g.id).length;
    if (n) lines.push(`  ${g.id}["${g.label}<br/>${n} projects"]`);
  }
  for (const [key, n] of [...counts].sort(([a], [b]) => byText(a, b))) {
    const [from, to] = key.split('->');
    lines.push(`  ${from} -- ${n} --> ${to}`);
  }
  lines.push('```');
  return lines.join('\n');
}

function federationMermaid(remotes, projects, edges) {
  const lines = ['```mermaid', 'flowchart LR'];
  lines.push('  shell["angular-examples (shell)"]');
  for (const r of remotes) {
    lines.push(`  ${id(r)}["${r}"]`);
    lines.push(`  shell -. "loadRemoteModule" .-> ${id(r)}`);
    const libs = edges
      .filter((e) => e.source === r)
      .map((e) => e.target)
      .filter((t) => projects.find((p) => p.name === t)?.group !== 'apps');
    for (const lib of libs) lines.push(`  ${id(r)} --> ${id(lib)}["${lib}"]`);
  }
  lines.push('```');
  return lines.join('\n');
}

function metricsTable(projects) {
  const rows = projects
    .filter((p) => p.group !== 'infra')
    .sort(
      (a, b) => b.in + b.out - (a.in + a.out) || a.name.localeCompare(b.name)
    )
    .map(
      (p) =>
        `| \`${p.name}\` | ${p.group} | ${p.tags.join(', ') || '_none_'} | ${p.in} | ${p.out} | ${p.instability ?? '–'} |`
    );
  return [
    '| Project | Group | Tags | Fan-in (Ca) | Fan-out (Ce) | Instability |',
    '| ------- | ----- | ---- | ----------- | ------------ | ----------- |',
    ...rows,
  ].join('\n');
}

function findings(projects, cycles, violations) {
  const out = [];
  const list = (items) => items.map((i) => `  - ${i}`).join('\n');

  out.push(
    cycles.length
      ? `- **Circular dependencies:** ${cycles.length}\n${list(cycles.map((c) => c.map((n) => `\`${n}\``).join(' ↔ ')))}`
      : '- **Circular dependencies:** none'
  );
  out.push(
    violations.length
      ? `- **Tag constraint violations** (\`.oxlintrc.json\`): ${violations.length}\n${list(violations.map((v) => `\`${v.source}\` → \`${v.target}\` (\`${v.sourceTag}\` may only use ${v.allowed.map((t) => `\`${t}\``).join(', ')})`))}`
      : '- **Tag constraint violations** (`.oxlintrc.json`): none'
  );

  const orphans = projects.filter(
    (p) => p.in === 0 && !['apps', 'infra', 'public'].includes(p.group)
  );
  out.push(
    orphans.length
      ? `- **Unused libraries** (no project depends on them): ${orphans.length}\n${list(orphans.map((p) => `\`${p.name}\``))}`
      : '- **Unused libraries:** none'
  );

  const untagged = projects.filter((p) => p.tags.length === 0);
  out.push(
    untagged.length
      ? `- **Projects without tags** (invisible to module boundaries): ${untagged.length}\n${list(untagged.map((p) => `\`${p.name}\``))}`
      : '- **Projects without tags:** none'
  );

  const misplaced = projects.filter(
    (p) =>
      ['shared', 'utils'].includes(p.group) &&
      p.tags.length === 1 &&
      p.tags[0] === 'shared'
  );
  if (misplaced.length) {
    out.push(
      `- **Layer tags too coarse:** ${misplaced.length} projects in \`libs/shared\`/\`libs/utils\` only carry the generic \`shared\` tag, so the boundary rules cannot tell a utility from a shared domain lib\n${list(misplaced.map((p) => `\`${p.name}\``))}`
    );
  }

  const hubs = projects.filter((p) => p.group !== 'apps' && p.out >= 5);
  if (hubs.length) {
    out.push(
      `- **Libraries with high fan-out (≥ 5):** ${hubs.length}\n${list(hubs.map((p) => `\`${p.name}\` (${p.out})`))}`
    );
  }
  return out.join('\n');
}

function render() {
  const graph = readProjectGraph();
  const constraints = readDepConstraints();
  const remotes = readFederationRemotes();
  const { projects, edges } = buildModel(graph);
  const cycles = findCycles(projects, edges);
  const violations = findBoundaryViolations(projects, edges, constraints);

  return `<!-- Generated by tools/architecture/generate-diagrams.mjs. Do not edit by hand: run \`npm run arch:diagrams\`. -->

# Architecture Diagrams

Generated from the Nx project graph, the module boundary rules in
\`.oxlintrc.json\` and the Native Federation manifest. Regenerated every week by
the architecture routine; for the narrative overview see
[\`docs/ARCHITECTURE.md\`](../ARCHITECTURE.md).

**${projects.length} projects · ${edges.length} internal dependencies · ${remotes.length} federated remotes**

## Contents

- [Layer overview](#layer-overview)
- [Allowed dependencies (module boundaries)](#allowed-dependencies-module-boundaries)
- [Module Federation topology](#module-federation-topology)
- [Project dependency graph](#project-dependency-graph)
- [Modularity metrics](#modularity-metrics)
- [Automated findings](#automated-findings)

## Layer overview

Dependencies between project groups (edge label = number of project-level
dependencies).

${groupMermaid(projects, edges)}

## Allowed dependencies (module boundaries)

Tag rules enforced by \`@nx/enforce-module-boundaries\`. An arrow means
"projects tagged A may depend on projects tagged B" (a tag may always depend on
itself).

${layerMermaid(constraints)}

## Module Federation topology

${federationMermaid(remotes, projects, edges)}

## Project dependency graph

Solid arrows are static imports, dotted arrows are lazy (dynamic) imports and
thick arrows are implicit dependencies from \`project.json\` (e.g. a CDK stack
deploying an app). npm packages are not shown.

${projectGraphMermaid(projects, edges)}

## Modularity metrics

- **Fan-in (Ca)**: projects that depend on this one.
- **Fan-out (Ce)**: projects this one depends on.
- **Instability** = Ce / (Ca + Ce). Stable, widely used libraries should sit
  near 0; apps near 1. A library with high instability _and_ high fan-in is a
  change magnet.

${metricsTable(projects)}

## Automated findings

${findings(projects, cycles, violations)}
`;
}

function format(file) {
  execFileSync('npx', ['oxfmt', file], { cwd: ROOT, stdio: 'ignore' });
}

const content = render();
if (CHECK) {
  // Formatted next to the real file so oxfmt picks up the workspace config.
  const tmpFile = join(ROOT, 'docs/architecture/.README.check.md');
  writeFileSync(tmpFile, content);
  format(tmpFile);
  const fresh = readFileSync(tmpFile, 'utf8');
  rmSync(tmpFile, { force: true });
  if (fresh !== readFileSync(OUT_FILE, 'utf8')) {
    console.error(
      'docs/architecture/README.md is out of date. Run `npm run arch:diagrams`.'
    );
    process.exit(1);
  }
  console.log('Architecture diagrams are up to date.');
} else {
  writeFileSync(OUT_FILE, content);
  format(OUT_FILE);
  console.log(`Wrote ${OUT_FILE}`);
}
