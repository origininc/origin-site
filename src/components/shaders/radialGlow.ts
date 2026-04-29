export const radialGlowVert = /* glsl */ `
precision mediump float;

attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const radialGlowFrag = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uGlowStrength;
uniform float uGlowRadius;
uniform float uRadialStrength;
uniform float uRadialFalloff;

varying vec2 vUv;

void main() {
  vec2 texel = 1.0 / uResolution;
  vec4 srcSample = texture2D(uTexture, vUv);
  vec3 src = srcSample.rgb;
  float srcAlpha = srcSample.a;
  vec3 srcPremul = src * srcAlpha;

  vec3 premulSum = vec3(0.0);
  float alphaSum = 0.0;
  float weightSum = 0.0;

  for (int x = -3; x <= 3; x++) {
    for (int y = -3; y <= 3; y++) {
      vec2 offset = vec2(float(x), float(y)) * texel * uGlowRadius;
      vec4 sample = texture2D(uTexture, vUv + offset);
      vec3 s = sample.rgb;
      float sampleAlpha = sample.a;

      float w = 1.0 - length(vec2(float(x), float(y))) / 4.25;
      w = max(w, 0.0);

      float bright = smoothstep(0.08, 0.95, max(s.r, max(s.g, s.b)));
      w *= mix(0.35, 1.0, bright);

      premulSum += s * sampleAlpha * w;
      alphaSum += sampleAlpha * w;
      weightSum += w;
    }
  }

  float blurredAlpha = alphaSum / max(weightSum, 0.0001);
  vec3 blurred = alphaSum > 1e-5 ? premulSum / alphaSum : vec3(0.0);
  vec3 glow = max(blurred - src * 0.35, 0.0);

  vec2 centered = vUv - 0.5;
  float dist = length(centered) * 2.0;
  float radial = pow(max(0.0, 1.0 - dist), uRadialFalloff);
  float glowGain = uGlowStrength + radial * uRadialStrength;
  float glowAlpha = clamp(max(blurredAlpha - srcAlpha * 0.35, 0.0) * glowGain, 0.0, 1.0);
  vec3 glowPremul = glow * glowAlpha;
  vec3 resultPremul = srcPremul + glowPremul;
  float resultAlpha = clamp(srcAlpha + glowAlpha * (1.0 - srcAlpha), 0.0, 1.0);
  vec3 result =
    resultAlpha > 1e-5 ? resultPremul / resultAlpha : vec3(0.0);

  gl_FragColor = vec4(result, resultAlpha);
}
`;
