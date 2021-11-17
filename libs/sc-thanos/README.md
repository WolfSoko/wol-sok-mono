# sc-thanos
An angular directive that vaporizes your DOM Elements like Thanos. 
This library is generated with [Nx](https://nx.dev).


#### Live Demo:
Click the technology cards on https://angularexamples.superheroiccoding.de

## Usage
#### Dependencies: 
To install run 
```
npm install sc-thanos --save
```
This lib uses html2canvas. So please run 
```
npm install html2canvas --save.
``` 

#### Prepare your angular app: 
Add to your root app module.
```
@NgModule({
  ...
  imports: [...
    ScThanosModule.forRoot(options)
  ]
})
export class AppModule {...}
``` 

And add ScThanosModule to your shared module exports to make the directive available. 
``` 
@NgModule({
  ...
  exports: [...
    ScThanosModule
  ]
})
export class SharedModule {...}
]
``` 
#### `ScThanosOptions` to configure sc-thanos: 
| field        | type | default          | description  |
| ------------- | :-----: | -----: | -----:|
| animationLength | number | 5000 | the animation length in ms |
| maxParticleCount | number | 400000 |  max amount of particles |
| particleAcceleration | number | 30 |    speed of the particle acceleration |

###`ScThanosDirective` usage
Use the directive `scThanos` on your element and reference it using `@ViewChild(ScThanosDirective)` in your component
or directly in html via template ref: 
```
<div scThanos 
  #thanos="thanos" 
  (scThanosComplete)=onComplete()>
  This div will be vaporized on click
  </div>
<button (click)="thanos.vaporize(removeElement)"> 
```

###`ScThanosService` usage
Inject the 'ScThanosService' into your class. Call 'vaporize()' and subscribe to it.

## Collaboration
Send issues or PRs to https://github.com/wolsok/wol-sok-mono

Run `nx test sc-thanos` to execute the unit tests.
