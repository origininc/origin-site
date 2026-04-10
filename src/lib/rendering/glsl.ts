export const copyVert = `
precision mediump float;

attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const copyFrag = `
precision mediump float;

uniform sampler2D uTexture;
varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(uTexture, vUv);
}
`;

export const fieldBlurVert = `
precision mediump float;

attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const fieldBlurFrag = `
precision mediump float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uDirection;
uniform float uBlurRadius;

varying vec2 vUv;

float gaussian(float x, float sigma) {
  return exp(-(x * x) / (2.0 * sigma * sigma));
}

void main() {
  vec2 texel = 1.0 / uResolution;
  vec2 dir = uDirection * texel;

  vec4 sum = vec4(0.0);
  float weightSum = 0.0;

  for (int i = -8; i <= 8; i++) {
    float fi = float(i);
    float w = gaussian(fi, uBlurRadius);
    sum += texture2D(uTexture, vUv + dir * fi) * w;
    weightSum += w;
  }

  gl_FragColor = sum / max(weightSum, 0.0001);
}
`;