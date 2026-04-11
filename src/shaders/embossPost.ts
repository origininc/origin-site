export const embossPostVert = /* glsl */ `
precision mediump float;

attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const embossPostFrag = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uHeightScale;
uniform vec2 uLightDir;
uniform vec3 uBaseColor;
uniform float uAmbient;
uniform float uDiffuse;
uniform float uShadowStrength;
uniform float uSpecularStrength;
uniform float uSpecularPower;

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
  float hC = getHeight(vUv);

  vec3 n = normalize(vec3((hL - hR) * uHeightScale, (hD - hU) * uHeightScale, 1.0));

  vec3 lightDir = normalize(vec3(uLightDir, 1.0));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfDir = normalize(lightDir + viewDir);

  float ndl = max(dot(n, lightDir), 0.0);
  float ndh = max(dot(n, halfDir), 0.0);

  float diffuse = ndl * uDiffuse;
  float specular = pow(ndh, uSpecularPower) * uSpecularStrength;

  float cavity = smoothstep(0.0, 0.22, hC);
  float shadow = (1.0 - ndl) * uShadowStrength * cavity;

  // Cold shadow tint: subtract more from warm channels, less from blue
  vec3 shadowTint = vec3(1.08, 1.02, 0.7);

  vec3 color = uBaseColor;
  color *= (uAmbient + diffuse);
  color -= shadow * shadowTint;
  color += specular;

  gl_FragColor = vec4(color, 1.0);
}
`;