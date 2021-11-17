# SuperheroicCoding: Some examples with Angular+, Angular-Material, p5, three.js,  

Just some cool examples implemented in Angular for topics that I am interested in. 

The topics are science algorithms like poisson distribution and reaction diffusion.
Also shader programming with webgl and AI are given. 
Firebase is used for persistence of custom webgl shaders.  
For visualization p5 and three.js are used.

I always try to keep a good code structure as defined in the Angular style guide and Nx monorepo structure.
Also I love rxjs and use it as much as I can.
For components I use angular-material.    
CSS wise I try use grid and flex layout.

This project was generated with [Nx](https://nx.dev/l/a/getting-started/intro) 

To deploy it I use Github actions and AWS S3, with Cloudfront

## sc-thanos
A special library is extracted from these Experiments called sc-thanos. 
It's a cool vaporizing effect for your html Elements. 
[sc-thanos on npm](https://www.npmjs.com/package/sc-thanos)

Readme under: [Sc-Thanos README.md](./projects/sc-thanos/README.md)

A running version can be found on github pages: https://angularexamples.superheroiccoding.de/

## Development server
Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Service Worker
A serviceWorker configuration is generated if you run `ng build --prod`.
It is used to serve the page even when you are offline. 
You can test the service worker with `http-server -p 8080` from dist folder.

## Further help
To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).
