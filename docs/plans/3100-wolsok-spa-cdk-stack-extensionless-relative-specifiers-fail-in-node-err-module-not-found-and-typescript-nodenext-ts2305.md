# Plan: @wolsok/spa-cdk-stack loads in Node and under NodeNext

Spec: [docs/specs/3100-….md](../specs/3100-wolsok-spa-cdk-stack-extensionless-relative-specifiers-fail-in-node-err-module-not-found-and-typescript-nodenext-ts2305.md)

1. **Guard first**: `libs/public/spa-cdk-stack/src/package-format.spec.ts` parses `tsconfig.lib.json` (`ts.getParsedCommandLineOfConfigFile`) and expects `module` and `moduleResolution` to be `Node16` or `NodeNext`. Run `nx test spa-cdk-stack`: red.
2. **Fix**: `tsconfig.lib.json` gets `"module": "node16", "moduleResolution": "node16"`. `nx test spa-cdk-stack`: green. `nx build spa-cdk-stack`: `"type": "commonjs"`.
3. **Consumer check** (manual, in the scratchpad, results in the PR): `npm pack` the build, install it in an empty project with `typescript@6.0.3`, run `require`, `import` and `tsc --module NodeNext` on `.mts` and `.cts` files.
4. Checks: `nx format:write`, `nx affected -t lint,lint-templates,test,build`. One commit `fix(spa-cdk-stack): publish CommonJS that Node and NodeNext resolve`, PR with `Closes #3100`.
