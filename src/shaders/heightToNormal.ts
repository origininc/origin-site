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
uniform vec2 uResolution;
uniform float uHeightScale;

varying vec2 vUv;

float getHeight(vec2 uv) {
  return texture2D(uTexture, uv).r;
}

void main() {
  vec2 texel = 1.0 / uResolution;

  float hL = getHeight(vUv - vec2(texel.x, 0.0));
  float hR = getHeight(vUv + vec2(texel.x, 0.0));
  float hD = getHeight(vUv - vec2(0.0, texel.y));
  float hU = getHeight(vUv + vec2(0.0, texel.y));

  vec3 n = normalize(vec3(
    (hL - hR) * uHeightScale,
    (hD - hU) * uHeightScale,
    1.0
  ));

  vec3 enc = n * 0.5 + 0.5;

  gl_FragColor = vec4(enc, 1.0);
}
`;