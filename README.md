[![.github/workflows/ci.yml](https://github.com/WolfSoko/wol-sok-mono/actions/workflows/ci.yml/badge.svg)](https://github.com/WolfSoko/wol-sok-mono/actions/workflows/ci.yml)

wol-sok-mono repo
# Wild experiments and examples implemented in Angular+

Just some examples implemented in angular for topics that are interesting to me.

The topics are science algorithms like poisson distribution and reaction diffusion. Also examples for shader programming
with webgl and AI are given. Firebase is used for persistence of custom webgl shaders.  
For visualization p5 and three.js are used.

I always try to keep a good code structure as defined in the Angular style guide and NX monorepo structure. Also I love
rxjs and use it as much as I can. For components, I use Angular-Material.  
CSS wise I use grid and flex layout.

This project utilizes the features of [Nx](https://nx.dev/l/a/getting-started/intro) Monorepo

## ws-thanos

A special angular-component is extracted from these experiments called `ws-thanos`. It vaporizes your html Elements into
tiny atoms.
[@wolsok/thanos on npm](https://www.npmjs.com/package/@wolsok/thanos)

Readme under: [README.md](./libs/public/ws-thanos/README.md)

A running version can be found on github pages: https://angularexamples.wolsok.de/

### npm install
To run `npm install` you need to make sure `node-gyp` compilation process is working. See here: [node-gyp installation](https://github.com/nodejs/node-gyp#installation)
