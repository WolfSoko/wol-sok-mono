const defaultHeader = `# version 300 es
#ifdef GL_ES
  precision highp float;
#endif

uniform highp vec2 uResolution;
uniform mediump vec2 uMouse;
uniform highp float uTime;

out highp vec4 fragColor;

`;

const defaultShadersV2 = [
  {
    code: `${defaultHeader}
void main() {
    fragColor = vec4(1.0,0.0,1.0,1.0);
}`,
    description: 'Just pink!',
  },
  {
    code: `${defaultHeader}
void main() {
    fragColor = vec4(abs(sin(uTime)),0.0,0.0,1.0);
}`,
    description: 'Using uTime to change color',
  },
  {
    code: `${defaultHeader}
void main() {
    vec2 st = gl_FragCoord.xy/uResolution;
    fragColor = vec4(st, 0.0, 1.0);
}
`,
    description: 'Using gl_FragCoord to colorize',
  },
  {
    code: `${defaultHeader}
vec3 colorA = vec3(0.149,0.141,0.912);
vec3 colorB = vec3(1.000,0.833,0.224);

void main() {
    vec3 color = vec3(0.0);

    float pct = abs(sin(uTime));

    // Mix uses pct (a value from 0-1) to
    // mix the two colors
    color = mix(colorA, colorB, pct);

    fragColor = vec4(color,1.0);
}`,
    description: 'Mixing colors',
  },
  {
    code: `${defaultHeader}#define PI 3.14159265359
vec3 colorA = vec3(0.149,0.141,0.912);
vec3 colorB = vec3(1.000,0.833,0.224);

float plot(vec2 st, float pct){
    return smoothstep( pct-0.01, pct, st.y) -
           smoothstep( pct, pct+0.01, st.y);
}

void main() {
    vec2 st = gl_FragCoord.xy/uResolution.xy;
    vec3 color = vec3(0.0);

    vec3 pct = vec3(st.x);

    pct.r = smoothstep(0.0, uMouse.x, st.x);
    pct.g = sin(st.x*PI * ((uMouse.x + uMouse.y)));
    pct.b = pow(abs(st.x), uMouse.y);

    color = mix(colorA, colorB, pct);

    // Plot transition lines for each channel
    color = mix(color,vec3(1.0,0.0,0.0),plot(st,pct.r));
    color = mix(color,vec3(0.0,1.0,0.0),plot(st,pct.g));
    color = mix(color,vec3(0.0,0.0,1.0),plot(st,pct.b));

    fragColor = vec4(color,1.0);
}`,
    description: 'Mixing colors and show transition lines',
  },
  {
    code: `${defaultHeader}
#define TWO_PI 6.28318530718

// Function from Iñigo Quiles
// https://www.shadertoy.com/view/MsS3Wc
vec3 hsb2rgb( in vec3 c ){
    vec3 rgb = clamp(
                 abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),
                 6.0)-3.0)-1.0,
                 0.0,
                 1.0
               );
    rgb = rgb*rgb*(3.0-2.0*rgb);
    return c.z * mix( vec3(1.0), rgb, c.y);
}

void main(){
    vec2 st = gl_FragCoord.xy/uResolution;
    vec3 color = vec3(0.0);

    // Use polar coordinates instead of cartesian
    vec2 toCenter = uMouse-st;
    float angle = atan(toCenter.y,toCenter.x);
    float radius = length(toCenter)*2.0;

    // Map the angle (-PI to PI) to the Hue (from 0 to 1)
    // and the Saturation to the radius
    color = hsb2rgb(vec3((angle/TWO_PI)+0.5 + uMouse.y,radius,1.0));


    fragColor = vec4(color,1.0);
}`,
    description: 'Hue Colors',
  },
  {
    code: `${defaultHeader}
// Plot a line on Y using a value between 0.0-1.0
float plot(vec2 st, float pct){
    return smoothstep( pct-0.02, pct, st.y) -
           smoothstep( pct, pct+0.02, st.y);
}

void main() {
    vec2 st = gl_FragCoord.xy/uResolution;

    float y = st.x;

    vec3 color = vec3(y);

    // Plot a line
    float pct = plot(st,y);
    color = (1.0-pct)*color+pct*vec3(0.0,1.0,0.0);

    fragColor = vec4(color,1.0);
}`,
    description: 'Smoothstep function',
  },
  {
    code: `${defaultHeader}
#define PI 3.14159265359

float plot(vec2 st, float pct){
    return smoothstep( pct-0.02, pct, st.y) -
           smoothstep( pct, pct+0.02, st.y);
}

void main() {
    vec2 st = gl_FragCoord.xy/uResolution;

    float y = pow(st.x, 10.0 * uMouse.y);

    vec3 color = vec3(y);

    float pct = plot(st,y);
    color = (1.0-pct)*color+pct*vec3(0.0,1.0,0.0);

    fragColor = vec4(color,1.0);
}`,
    description: 'Power function',
  },
  {
    code: `${defaultHeader}
#define PI 3.14159265359

float plot(vec2 st, float pct){
    return smoothstep( pct-0.02, pct, st.y) -
           smoothstep( pct, pct+0.02, st.y);
}

void main() {
    vec2 st = gl_FragCoord.xy/uResolution;

    // Step will return 0.0 unless the value is over uMouse.x,
    // in that case it will return 1.0
    float y = step(uMouse.x,st.x);

    vec3 color = vec3(y);

    float pct = plot(st,y);
    color = (1.0-pct)*color+pct*vec3(0.0,1.0,0.0);

    fragColor = vec4(color,1.0);
}`,
    description: 'Step function',
  },
  {
    code: `${defaultHeader}
 void main(){
     vec2 st = gl_FragCoord.xy/uResolution.xy;
     vec3 color = vec3(0.0);

     // bottom-left
     vec2 bl = step(vec2(uMouse.x, uMouse.y),st);
     float pct = bl.x * bl.y;

     // top-right
      vec2 tr = step(vec2(0.1),1.0-st);
      pct *= tr.x * tr.y;

     color = vec3(pct);

     fragColor = vec4(color,1.0);
 }`,
    description: 'Rectangle',
  },
  {
    code: `${defaultHeader}
 float circle(in vec2 _st, in float _radius, in vec2 center){
     vec2 dist = _st - center;
     dist = dist * vec2(uResolution.x / uResolution.y, 1.0);
     return 1.-smoothstep(_radius-(_radius*0.01),
                          _radius+(_radius*0.01),
                          dot(dist,dist)*4.0);
 }

 void main(){
     vec2 st = gl_FragCoord.xy/uResolution.xy;

     // cirlce
     float bl = circle(st, 0.1 * sin(uTime * 5.0) + 0.2, uMouse);

     vec3 color = vec3(bl);
     fragColor = vec4(color,1.0);
 }`,
    description: 'Circle',
  },
  {
    code: `${defaultHeader}
vec2 random2( vec2 p ) {
    return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
}

void main() {
    vec2 st = gl_FragCoord.xy/uResolution.xy;
    st.x *= uResolution.x/uResolution.y;
    vec3 color = vec3(.0);

    // Scale
    st *= 3.;

    // Tile the space
    vec2 i_st = floor(st);
    vec2 f_st = fract(st);

    float m_dist = 1.;  // minimun distance

    for (int y= -1; y <= 1; y++) {
       for (int x= -1; x <= 1; x++) {
           // Neighbor place in the grid
           vec2 neighbor = vec2(float(x),float(y));

           // Random position from current + neighbor place in the grid
           vec2 point = random2(i_st + neighbor);

     // Animate the point
           point = 0.5 + 0.5*sin(uTime + 6.2831*point);

     // Vector between the pixel and the point
           vec2 diff = neighbor + point - f_st;

           // Distance to the point
           float dist = length(diff);

           // Keep the closer distance
           m_dist = min(m_dist, dist);
       }
    }

    // Draw the min distance (distance field)
    color += m_dist;

    // Draw cell center
    color += 1.-step(.02, m_dist);

    // Draw grid
    // color.r += step(.98, f_st.x) + step(.98, f_st.y);

    // Show isolines
    // color -= step(.7,abs(sin(27.0*m_dist)))*.5;

    fragColor = vec4(color,1.0);
 }`,
    description: 'Cellular Noise',
  },
  {
    code: `${defaultHeader}
float random (in vec2 _st) {
   return fract(sin(dot(_st.xy,
                        vec2(12.9898,78.233)))*
       43758.5453123);
}

// Based on Morgan McGuire @morgan3d
// https://www.shadertoy.com/view/4dS3Wd
float noise (in vec2 _st) {
   vec2 i = floor(_st);
   vec2 f = fract(_st);

   // Four corners in 2D of a tile
   float a = random(i);
   float b = random(i + vec2(1.0, 0.0));
   float c = random(i + vec2(0.0, 1.0));
   float d = random(i + vec2(1.0, 1.0));

   vec2 u = f * f * (3.0 - 2.0 * f);

   return mix(a, b, u.x) +
           (c - a)* u.y * (1.0 - u.x) +
           (d - b) * u.x * u.y;
}

#define NUM_OCTAVES 5

float fbm ( in vec2 _st) {
   float v = 0.0;
   float a = 0.5;
   vec2 shift = vec2(100.0);
   // Rotate to reduce axial bias
   mat2 rot = mat2(cos(0.5), sin(0.5),
                   -sin(0.5), cos(0.50));
   for (int i = 0; i < NUM_OCTAVES; ++i) {
       v += a * noise(_st);
       _st = rot * _st * 2.0 + shift;
       a *= 0.5;
   }
   return v;
}

void main() {
   vec2 dim = gl_FragCoord.xy/uResolution.xy;
   vec2 st = dim*vec2(3., 3. * uResolution.y / uResolution.x);
    st += st * abs(sin(uTime*0.1)*3.0);
   vec3 color = vec3(0.0);

   vec2 q = vec2(0.);
   q.x = fbm( st + 0.00*uTime);
   q.y = fbm( st + vec2(1.0));

   vec2 r = vec2(0.);
   r.x = fbm( st + 1.0*q + vec2(1.7,9.2)+ 0.15*uTime );
   r.y = fbm( st + 1.0*q + vec2(8.3,2.8)+ 0.126*uTime);

   r = r * uMouse;

   float f = fbm(st+r);

   color = mix(vec3(0.101961,0.619608,0.666667),
               vec3(0.666667,0.666667,0.498039),
               clamp((f*f)*4.0,0.0,1.0));

   color = mix(color,
               vec3(0,0,0.164706),
               clamp(length(q),0.0,1.0));

   color = mix(color,
               vec3(0.666667,1,1),
               clamp(length(r.x),0.0,1.0));

   fragColor = vec4((f*f*f+.6*f*f+.5*f)*color,1.);
 }`,
    description: 'Smoke noise',
  },
  {
    description: 'Colorfull cirlce',
    code: `${defaultHeader}
#define TWO_PI 6.28318530718

//  Function from Iñigo Quiles
//  https://www.shadertoy.com/view/MsS3Wc
vec3 hsb2rgb( in vec3 c ){
   vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),
                            6.0)-3.0)-1.0,
                    0.0,
                    1.0 );
   rgb = rgb*rgb*(3.0-2.0*rgb);
   return c.z * mix( vec3(1.0), rgb, c.y);
}

void main(){
   vec2 st = gl_FragCoord.xy/uResolution.xy;
   // repeat it
   st = st * vec2(1., uResolution.y / uResolution.x) * 2.;
   float angle = sin(uMouse.x * TWO_PI / 4.);
   float radius = uMouse.y;
   vec3 color = hsb2rgb(vec3(angle, radius, 1.0));
   float distToCenter = length(fract(st) - uMouse) + sin(uTime * 4.) * 0.03;

   float distanceCircle = smoothstep(distToCenter - 0.05, distToCenter, length(uMouse - 0.5)) +
   smoothstep( distToCenter, distToCenter + 0.05, length(uMouse - 0.5));

   color =  mix(color, vec3(distanceCircle), distToCenter);
   fragColor = vec4(color, 1.0);
}
     `,
  },
];
module.exports = { defaultShaders: defaultShadersV2 };
