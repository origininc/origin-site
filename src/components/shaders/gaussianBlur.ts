export const gaussianBlurVert = /* glsl */ `
precision mediump float;

attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const gaussianBlurFrag = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uDirection;
uniform float uBlurAmount;

varying vec2 vUv;

vec4 sampleWeighted(vec2 uv, float weight) {
  vec4 sample = texture2D(uTexture, uv);
  return vec4(sample.rgb * sample.a * weight, sample.a * weight);
}

void main() {
  vec2 texel = 1.0 / max(uResolution, vec2(1.0));
  vec2 stepOffset = uDirection * texel * uBlurAmount;

  vec4 accum = sampleWeighted(vUv, 0.2270270270);
  accum += sampleWeighted(vUv + stepOffset * 1.0, 0.1945945946);
  accum += sampleWeighted(vUv - stepOffset * 1.0, 0.1945945946);
  accum += sampleWeighted(vUv + stepOffset * 2.0, 0.1216216216);
  accum += sampleWeighted(vUv - stepOffset * 2.0, 0.1216216216);
  accum += sampleWeighted(vUv + stepOffset * 3.0, 0.0540540541);
  accum += sampleWeighted(vUv - stepOffset * 3.0, 0.0540540541);
  accum += sampleWeighted(vUv + stepOffset * 4.0, 0.0162162162);
  accum += sampleWeighted(vUv - stepOffset * 4.0, 0.0162162162);

  float alpha = clamp(accum.a, 0.0, 1.0);
  vec3 color = alpha > 1e-5 ? accum.rgb / alpha : vec3(0.0);

  gl_FragColor = vec4(color, alpha);
}
`;
