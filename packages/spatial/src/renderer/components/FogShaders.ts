import { ShaderChunk } from 'three'

const _NOISE_GLSL = `
//
// Description : Array and textureless GLSL 2D/3D/4D simplex
//               noise functions.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : stegu
//     Lastmod : 20201014 (stegu)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
//               https://github.com/stegu/webgl-noise
//
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec4 permute(vec4 x) {
     return mod289(((x*34.0)+1.0)*x);
}
vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}
float snoise(vec3 v)
{
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;
// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  //   x0 = x0 - 0.0 + 0.0 * C.xxx;
  //   x1 = x0 - i1  + 1.0 * C.xxx;
  //   x2 = x0 - i2  + 2.0 * C.xxx;
  //   x3 = x0 - 1.0 + 3.0 * C.xxx;
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y
// Permutations
  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
// Gradients: 7x7 points over a square, mapped onto an octahedron.
// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
  //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
// Mix final noise value
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 105.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}
float FBM(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 0.0;
  for (int i = 0; i < 6; ++i) {
    value += amplitude * snoise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}
`

export const FogShaders = {
  fog_fragment: {
    default: ShaderChunk.fog_fragment,
    brownianMotionFog: `#ifdef USE_FOG
        vec3 fogOrigin = cameraPosition;
        vec3 fogDirection = normalize(fogWorldPosition - fogOrigin);
        float fogDepth = myDistance(fogWorldPosition, fogOrigin);
        // f(p) = fbm( p + fbm( p ) )
        vec3 noiseSampleCoord = fogWorldPosition * 0.00025 + vec3(
            0.0, 0.0, fogTime * fogTimeScale * 0.025);
        float noiseSample = FBM(noiseSampleCoord + FBM(noiseSampleCoord)) * 0.5 + 0.5;
        fogDepth *= mix(noiseSample, 1.0, saturate((fogDepth - 5000.0) / 5000.0));
        fogDepth *= fogDepth;
        float fogFactor = heightFactor * exp(-fogOrigin.y * fogDensity) * (
            1.0 - exp(-fogDepth * fogDirection.y * fogDensity)) / fogDirection.y;
        fogFactor = saturate(fogFactor);
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
      #endif`,
    heightFog: `
      #ifdef USE_FOG
        vec3 fogOrigin = cameraPosition;
        vec3 fogDirection = normalize(fogWorldPosition - fogOrigin);
        float fogDepth = myDistance(fogWorldPosition, fogOrigin);

        float fogFactor = heightFactor * exp(-fogOrigin.y * fogDensity) * (
            1.0 - exp(-fogDepth * fogDirection.y * fogDensity)) / fogDirection.y;
        fogFactor = saturate(fogFactor);
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
      #endif`
  },
  fog_pars_fragment: {
    default: ShaderChunk.fog_pars_fragment,
    brownianMotionFog:
      _NOISE_GLSL +
      `
      float myDistance(vec3 a, vec3 b) {
        return length(a - b);
      } 
      #ifdef USE_FOG
        uniform float fogTime;
        uniform float fogTimeScale;
        uniform vec3 fogColor;
        varying vec3 fogWorldPosition;
        #ifdef FOG_EXP2
          uniform float fogDensity;
          uniform float heightFactor;
        #else
          uniform float fogNear;
          uniform float fogFar;
        #endif
      #endif`,
    heightFog: `
      float myDistance(vec3 a, vec3 b) {
        return length(a - b);
      }
      #ifdef USE_FOG
        uniform vec3 fogColor;
        varying vec3 fogWorldPosition;
        #ifdef FOG_EXP2
          uniform float fogDensity;
          uniform float heightFactor;
        #else
          uniform float fogNear;
          uniform float fogFar;
        #endif
      #endif`
  },
  fog_vertex: {
    default: ShaderChunk.fog_vertex,
    brownianMotionFog: `
      #ifdef USE_FOG
        fogWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz; // From local position to global position
      #endif`,
    heightFog: `
      #ifdef USE_FOG
        fogWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz; // From local position to global position
      #endif`
  },
  fog_pars_vertex: {
    default: ShaderChunk.fog_pars_vertex,
    brownianMotionFog: `
      #ifdef USE_FOG
        varying vec3 fogWorldPosition;
      #endif`,
    heightFog: `
      #ifdef USE_FOG
        varying vec3 fogWorldPosition;
      #endif`
  }
}

export function initBrownianMotionFogShader() {
  ShaderChunk.fog_pars_vertex = FogShaders.fog_pars_vertex.brownianMotionFog
  ShaderChunk.fog_vertex = FogShaders.fog_vertex.brownianMotionFog
  ShaderChunk.fog_pars_fragment = FogShaders.fog_pars_fragment.brownianMotionFog
  ShaderChunk.fog_fragment = FogShaders.fog_fragment.brownianMotionFog
}

export function initHeightFogShader() {
  ShaderChunk.fog_fragment = FogShaders.fog_fragment.heightFog
  ShaderChunk.fog_pars_fragment = FogShaders.fog_pars_fragment.heightFog
  ShaderChunk.fog_vertex = FogShaders.fog_vertex.heightFog
  ShaderChunk.fog_pars_vertex = FogShaders.fog_pars_vertex.heightFog
}

export function removeFogShader() {
  ShaderChunk.fog_pars_fragment = FogShaders.fog_pars_fragment.default
  ShaderChunk.fog_pars_vertex = FogShaders.fog_pars_vertex.default
  ShaderChunk.fog_fragment = FogShaders.fog_fragment.default
  ShaderChunk.fog_vertex = FogShaders.fog_vertex.default
}
