export const densityResolveVert = /* glsl */ `
precision mediump float;

attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const densityResolveFrag = /* glsl */ `
precision mediump float;

uniform sampler2D uTexture;
uniform float uDensityGain;

varying vec2 vUv;

void main() {
  vec4 tex = texture2D(uTexture, vUv);

  float density = tex.a * uDensityGain;
  vec3 avgColor = tex.rgb / max(tex.a, 0.0001);

  float base = density / (density + 0.28);
  float mappedDensity = smoothstep(0.08, 0.72, base);
  mappedDensity = pow(mappedDensity, 0.9);
  mappedDensity *= 0.82;

  vec3 color = avgColor * mappedDensity;

  gl_FragColor = vec4(color, 1.0);
}
`;