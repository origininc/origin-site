export const heightToNormalVert = /* glsl */ `
precision mediump float;

attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const heightToNormalFrag = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uTexture;
uniform sampler2D uPlasticNormal;
uniform vec2 uResolution;
uniform float uHeightScale;

varying vec2 vUv;

vec3 samplePlasticNormal(vec2 uv) {
  vec2 plasticUv = fract(uv * 0.8);
  vec3 nTex = texture2D(uPlasticNormal, plasticUv).rgb * 2.0 - 1.0;
  return normalize(nTex);
}

float samplePlasticRelief(vec2 uv) {
  vec3 n = samplePlasticNormal(uv);

  float relief = (n.x * 0.5 + n.y * 0.5);

  return relief;
}

float getCompositeHeight(vec2 uv) {
  vec3 plasticN = samplePlasticNormal(uv);

  float rawBase = texture2D(uTexture, uv).r;

  float edgeZone =
    smoothstep(0.01, 0.04, rawBase) *
    (1.0 - smoothstep(0.08, 0.16, rawBase));

  float reveal = smoothstep(0.025, 0.16, rawBase);

  vec2 warp = plasticN.xy * 0.05 * edgeZone;

  float baseH = texture2D(uTexture, uv + warp).r;

  float plasticRelief = samplePlasticRelief(uv);

  float contourWarp = plasticRelief * 0.10 * edgeZone;

  float interiorRelief = plasticRelief * 0.02 * reveal;

  float h = baseH + contourWarp + interiorRelief;

  return max(h, 0.0);
}

void main() {
  vec2 texel = 1.0 / uResolution;

  float hL = getCompositeHeight(vUv - vec2(texel.x, 0.0));
  float hR = getCompositeHeight(vUv + vec2(texel.x, 0.0));
  float hD = getCompositeHeight(vUv - vec2(0.0, texel.y));
  float hU = getCompositeHeight(vUv + vec2(0.0, texel.y));

  vec3 n = normalize(vec3(
    (hL - hR) * (uHeightScale * 1.9),
    (hD - hU) * (uHeightScale * 1.9),
    1.0
  ));

  vec3 enc = n * 0.5 + 0.5;
  gl_FragColor = vec4(enc, 1.0);
}
`;