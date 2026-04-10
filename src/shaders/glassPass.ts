export const glassPassVert = /* glsl */ `
precision mediump float;

attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const glassPassFrag = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uBackground;
uniform sampler2D uHeightTexture;
uniform sampler2D uNormalTexture;
uniform vec2 uResolution;

varying vec2 vUv;

vec3 sampleBg(vec2 uv) {
  return texture2D(uBackground, clamp(uv, 0.0, 1.0)).rgb;
}

vec3 blurBackground(vec2 uv, vec2 resolution) {
  vec2 texel = 1.0 / resolution;

  vec3 c0 = sampleBg(uv);
  vec3 c1 = sampleBg(uv + vec2( texel.x * 2.0, 0.0));
  vec3 c2 = sampleBg(uv + vec2(-texel.x * 2.0, 0.0));
  vec3 c3 = sampleBg(uv + vec2(0.0,  texel.y * 2.0));
  vec3 c4 = sampleBg(uv + vec2(0.0, -texel.y * 2.0));

  return (c0 * 0.52) + (c1 * 0.12) + (c2 * 0.12) + (c3 * 0.12) + (c4 * 0.12);
}

void main() {
  float height = texture2D(uHeightTexture, vUv).r;
  vec3 nTex = texture2D(uNormalTexture, vUv).rgb;
  vec3 n = normalize(nTex * 2.0 - 1.0);

  vec2 local = n.xy;
  float slope = length(local);

  float mask = smoothstep(0.02, 0.10, height);
  float baseGlass = 0.035;
  float glassAmt = max(mask, baseGlass);

  float r = clamp(length(local) * 1.15, 0.0, 1.0);
  float curvature = pow(r, 1.0);

  vec2 domeDir = normalize(local + vec2(1e-6));
  vec2 domeNormal = domeDir * curvature;

  float eta = 1.0 / 1.12;

  vec2 incident = -domeNormal;
  vec2 refractVec = refract(incident, domeNormal, eta);

  // Shape-driven refraction
  vec2 curvedUV = vUv + refractVec * (0.2 * glassAmt);

  float contourFalloff = smoothstep(0.02, 0.30, slope) * glassAmt;
  vec2 contourNormal = domeDir * pow(contourFalloff, 1.35);
  vec2 refractVecContour = refract(vec2(0.0), contourNormal, eta);
  vec2 contourUV = vUv + refractVecContour * (0.18 * contourFalloff);

  float edgeWeight = smoothstep(0.0, 1.0, r);
  float combinedWeight = clamp(edgeWeight * 0.85, 0.0, 1.0);
  vec2 normalDrivenUV = mix(curvedUV, contourUV, combinedWeight);

  // ---- baseline glass fallback ----
  // this gives a tiny lens-like distortion even where the normals are flat
  vec2 centered = vUv - 0.5;
  centered.x *= uResolution.x / max(uResolution.y, 1.0);
  vec2 baselineDir = normalize(centered + vec2(1e-6));
  vec2 baselineUV = vUv + baselineDir * (0.0035 * baseGlass);

  // Use baseline in flat areas, real normal distortion where the form exists
  vec2 refractUV = mix(baselineUV, normalDrivenUV, mask);

  vec3 refracted = sampleBg(refractUV);
  vec3 blurred = blurBackground(refractUV, uResolution);

  // Use glassAmt here, not mask
  float blurMix = mix(0.025, 0.06, glassAmt);
  vec3 base = mix(refracted, blurred, blurMix);

  float highlight = pow(clamp(1.0 - slope * 1.35, 0.0, 1.0), 3.0) * glassAmt;
  float edge = smoothstep(0.10, 0.55, slope) * glassAmt;

  vec3 color = base;
  color += vec3(1.0) * (highlight * 0.08);
  color += vec3(0.98, 0.99, 1.0) * (edge * 0.025);

  gl_FragColor = vec4(color, 1.0);
}
`;