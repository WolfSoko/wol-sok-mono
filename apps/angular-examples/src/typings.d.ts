/* SystemJS module definition */
// eslint-disable-next-line no-var
declare var module: NodeModule;

declare namespace globalThis {
  const VERSION: string;
}

interface NodeModule {
  id: string;
}
