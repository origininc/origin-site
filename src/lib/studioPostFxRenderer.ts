import {
  asciiPostFrag,
  asciiPostVert,
} from "@/components/shaders/asciiPost";
import {
  horizontalBlurFrag,
  horizontalBlurVert,
} from "@/components/shaders/horizontalBlur";
import {
  radialGlowFrag,
  radialGlowVert,
} from "@/components/shaders/radialGlow";
import {
  temporalChromaticAberrationFrag,
  temporalChromaticAberrationVert,
} from "@/components/shaders/temporalChromaticAberration";
import {
  vignetteFrag,
  vignetteVert,
} from "@/components/shaders/vignette";
import type { StudioFxSettings } from "@/lib/studioFx";

const copyVert = /* glsl */ `
precision mediump float;

attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const copyFrag = /* glsl */ `
precision mediump float;

uniform sampler2D uTexture;
varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(uTexture, vUv);
}
`;

type CopyUniforms = {
  texture: WebGLUniformLocation | null;
};

type BlurUniforms = {
  blurAmount: WebGLUniformLocation | null;
  resolution: WebGLUniformLocation | null;
  texture: WebGLUniformLocation | null;
};

type AsciiUniforms = {
  mouse: WebGLUniformLocation | null;
  pixelation: WebGLUniformLocation | null;
  resolution: WebGLUniformLocation | null;
  texture: WebGLUniformLocation | null;
};

type ChromaticUniforms = {
  resolution: WebGLUniformLocation | null;
  strength: WebGLUniformLocation | null;
  texture: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
};

type GlowUniforms = {
  glowRadius: WebGLUniformLocation | null;
  glowStrength: WebGLUniformLocation | null;
  radialFalloff: WebGLUniformLocation | null;
  radialStrength: WebGLUniformLocation | null;
  resolution: WebGLUniformLocation | null;
  texture: WebGLUniformLocation | null;
};

type VignetteUniforms = {
  power: WebGLUniformLocation | null;
  strength: WebGLUniformLocation | null;
  texture: WebGLUniformLocation | null;
  zoom: WebGLUniformLocation | null;
};

type RenderFrame = {
  renderHeight: number;
  renderWidth: number;
  settings: StudioFxSettings;
  source: TexImageSource;
};

const createShader = (
  gl: WebGLRenderingContext,
  type: number,
  source: string
) => {
  const shader = gl.createShader(type);

  if (!shader) {
    throw new Error("Unable to allocate shader.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(info || "Shader compile failed.");
  }

  return shader;
};

const createProgram = (
  gl: WebGLRenderingContext,
  vertSource: string,
  fragSource: string
) => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragSource);
  const program = gl.createProgram();

  if (!program) {
    throw new Error("Unable to allocate program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(info || "Program link failed.");
  }

  return program;
};

const createTexture = (gl: WebGLRenderingContext) => {
  const texture = gl.createTexture();

  if (!texture) {
    throw new Error("Unable to allocate texture.");
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  return texture;
};

const createFramebuffer = (gl: WebGLRenderingContext) => {
  const framebuffer = gl.createFramebuffer();

  if (!framebuffer) {
    throw new Error("Unable to allocate framebuffer.");
  }

  return framebuffer;
};

const assertFramebufferComplete = (
  gl: WebGLRenderingContext,
  framebuffer: WebGLFramebuffer,
  texture: WebGLTexture,
  width: number,
  height: number
) => {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  );

  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`Framebuffer incomplete: ${status}`);
  }
};

export class StudioPostFxRenderer {
  private allocatedHeight = 0;
  private allocatedWidth = 0;
  private readonly asciiProgram: WebGLProgram;
  private readonly asciiUniforms: AsciiUniforms;
  private readonly blurProgram: WebGLProgram;
  private readonly blurUniforms: BlurUniforms;
  private readonly canvas: HTMLCanvasElement;
  private readonly chromaticProgram: WebGLProgram;
  private readonly chromaticUniforms: ChromaticUniforms;
  private readonly copyProgram: WebGLProgram;
  private readonly copyUniforms: CopyUniforms;
  private readonly gl: WebGLRenderingContext;
  private readonly glowProgram: WebGLProgram;
  private readonly glowUniforms: GlowUniforms;
  private readonly maxTextureSize: number;
  private readonly passAFramebuffer: WebGLFramebuffer;
  private readonly passATexture: WebGLTexture;
  private readonly passBFramebuffer: WebGLFramebuffer;
  private readonly passBTexture: WebGLTexture;
  private readonly quadBuffer: WebGLBuffer;
  private readonly sourceTexture: WebGLTexture;
  private readonly vignetteProgram: WebGLProgram;
  private readonly vignetteUniforms: VignetteUniforms;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      throw new Error("WebGL is not supported in this browser.");
    }

    this.gl = gl;
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

    this.copyProgram = createProgram(gl, copyVert, copyFrag);
    this.blurProgram = createProgram(gl, horizontalBlurVert, horizontalBlurFrag);
    this.asciiProgram = createProgram(gl, asciiPostVert, asciiPostFrag);
    this.chromaticProgram = createProgram(
      gl,
      temporalChromaticAberrationVert,
      temporalChromaticAberrationFrag
    );
    this.glowProgram = createProgram(gl, radialGlowVert, radialGlowFrag);
    this.vignetteProgram = createProgram(gl, vignetteVert, vignetteFrag);

    const quadBuffer = gl.createBuffer();
    if (!quadBuffer) {
      throw new Error("Unable to allocate quad buffer.");
    }

    this.quadBuffer = quadBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]),
      gl.STATIC_DRAW
    );

    this.sourceTexture = createTexture(gl);
    this.passATexture = createTexture(gl);
    this.passBTexture = createTexture(gl);
    this.passAFramebuffer = createFramebuffer(gl);
    this.passBFramebuffer = createFramebuffer(gl);

    this.copyUniforms = {
      texture: gl.getUniformLocation(this.copyProgram, "uTexture"),
    };
    this.blurUniforms = {
      texture: gl.getUniformLocation(this.blurProgram, "uTexture"),
      resolution: gl.getUniformLocation(this.blurProgram, "uResolution"),
      blurAmount: gl.getUniformLocation(this.blurProgram, "uBlurAmount"),
    };
    this.asciiUniforms = {
      texture: gl.getUniformLocation(this.asciiProgram, "uTexture"),
      resolution: gl.getUniformLocation(this.asciiProgram, "uResolution"),
      mouse: gl.getUniformLocation(this.asciiProgram, "uMouse"),
      pixelation: gl.getUniformLocation(this.asciiProgram, "uPixelation"),
    };
    this.chromaticUniforms = {
      texture: gl.getUniformLocation(this.chromaticProgram, "uTexture"),
      resolution: gl.getUniformLocation(this.chromaticProgram, "uResolution"),
      strength: gl.getUniformLocation(this.chromaticProgram, "uStrength"),
      time: gl.getUniformLocation(this.chromaticProgram, "uTime"),
    };
    this.glowUniforms = {
      texture: gl.getUniformLocation(this.glowProgram, "uTexture"),
      resolution: gl.getUniformLocation(this.glowProgram, "uResolution"),
      glowStrength: gl.getUniformLocation(this.glowProgram, "uGlowStrength"),
      glowRadius: gl.getUniformLocation(this.glowProgram, "uGlowRadius"),
      radialStrength: gl.getUniformLocation(this.glowProgram, "uRadialStrength"),
      radialFalloff: gl.getUniformLocation(this.glowProgram, "uRadialFalloff"),
    };
    this.vignetteUniforms = {
      texture: gl.getUniformLocation(this.vignetteProgram, "uTexture"),
      strength: gl.getUniformLocation(this.vignetteProgram, "uStrength"),
      power: gl.getUniformLocation(this.vignetteProgram, "uPower"),
      zoom: gl.getUniformLocation(this.vignetteProgram, "uZoom"),
    };
  }

  dispose() {
    const { gl } = this;

    gl.deleteTexture(this.sourceTexture);
    gl.deleteTexture(this.passATexture);
    gl.deleteTexture(this.passBTexture);
    gl.deleteFramebuffer(this.passAFramebuffer);
    gl.deleteFramebuffer(this.passBFramebuffer);
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteProgram(this.copyProgram);
    gl.deleteProgram(this.blurProgram);
    gl.deleteProgram(this.asciiProgram);
    gl.deleteProgram(this.chromaticProgram);
    gl.deleteProgram(this.glowProgram);
    gl.deleteProgram(this.vignetteProgram);
  }

  getMaxTextureSize() {
    return this.maxTextureSize;
  }

  render({ source, renderWidth, renderHeight, settings }: RenderFrame) {
    const width = Math.max(1, Math.round(renderWidth));
    const height = Math.max(1, Math.round(renderHeight));

    if (width > this.maxTextureSize || height > this.maxTextureSize) {
      throw new Error(
        `Requested render ${width}×${height} exceeds WebGL texture limit ${this.maxTextureSize}.`
      );
    }

    this.canvas.width = width;
    this.canvas.height = height;
    this.allocPassTargets(width, height);

    const { gl } = this;

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source
    );

    let currentTexture = this.sourceTexture;
    let writeToA = true;

    const renderPassToFbo = (
      program: WebGLProgram,
      uniforms: (localWidth: number, localHeight: number) => void,
      inputTexture: WebGLTexture
    ) => {
      const targetFramebuffer = writeToA
        ? this.passAFramebuffer
        : this.passBFramebuffer;
      const targetTexture = writeToA ? this.passATexture : this.passBTexture;

      gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      this.bindFullscreenQuad(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, inputTexture);
      uniforms(width, height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      currentTexture = targetTexture;
      writeToA = !writeToA;
    };

    if (settings.blur.enabled) {
      renderPassToFbo(
        this.blurProgram,
        (localWidth, localHeight) => {
          gl.uniform1i(this.blurUniforms.texture, 0);
          gl.uniform2f(this.blurUniforms.resolution, localWidth, localHeight);
          gl.uniform1f(
            this.blurUniforms.blurAmount,
            settings.blur.uniforms.blurAmount
          );
        },
        currentTexture
      );
    }

    if (settings.ascii.enabled) {
      renderPassToFbo(
        this.asciiProgram,
        (localWidth, localHeight) => {
          gl.uniform1i(this.asciiUniforms.texture, 0);
          gl.uniform2f(this.asciiUniforms.resolution, localWidth, localHeight);
          gl.uniform2f(
            this.asciiUniforms.mouse,
            localWidth * 0.5,
            localHeight * 0.5
          );
          gl.uniform1f(
            this.asciiUniforms.pixelation,
            settings.ascii.uniforms.pixelation
          );
        },
        currentTexture
      );
    }

    if (settings.chromatic.enabled) {
      renderPassToFbo(
        this.chromaticProgram,
        (localWidth, localHeight) => {
          gl.uniform1i(this.chromaticUniforms.texture, 0);
          gl.uniform2f(
            this.chromaticUniforms.resolution,
            localWidth,
            localHeight
          );
          gl.uniform1f(this.chromaticUniforms.time, 0);
          gl.uniform1f(
            this.chromaticUniforms.strength,
            settings.chromatic.uniforms.strength
          );
        },
        currentTexture
      );
    }

    if (settings.glow.enabled) {
      renderPassToFbo(
        this.glowProgram,
        (localWidth, localHeight) => {
          gl.uniform1i(this.glowUniforms.texture, 0);
          gl.uniform2f(this.glowUniforms.resolution, localWidth, localHeight);
          gl.uniform1f(
            this.glowUniforms.glowStrength,
            settings.glow.uniforms.glowStrength
          );
          gl.uniform1f(
            this.glowUniforms.glowRadius,
            settings.glow.uniforms.glowRadius
          );
          gl.uniform1f(
            this.glowUniforms.radialStrength,
            settings.glow.uniforms.radialStrength
          );
          gl.uniform1f(
            this.glowUniforms.radialFalloff,
            settings.glow.uniforms.radialFalloff
          );
        },
        currentTexture
      );
    }

    if (settings.vignette.enabled) {
      renderPassToFbo(
        this.vignetteProgram,
        () => {
          gl.uniform1i(this.vignetteUniforms.texture, 0);
          gl.uniform1f(
            this.vignetteUniforms.strength,
            settings.vignette.uniforms.strength
          );
          gl.uniform1f(
            this.vignetteUniforms.power,
            settings.vignette.uniforms.power
          );
          gl.uniform1f(
            this.vignetteUniforms.zoom,
            settings.vignette.uniforms.zoom
          );
        },
        currentTexture
      );
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.copyProgram);
    this.bindFullscreenQuad(this.copyProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentTexture);
    gl.uniform1i(this.copyUniforms.texture, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private allocPassTargets(width: number, height: number) {
    if (width === this.allocatedWidth && height === this.allocatedHeight) {
      return;
    }

    const { gl } = this;

    assertFramebufferComplete(
      gl,
      this.passAFramebuffer,
      this.passATexture,
      width,
      height
    );
    assertFramebufferComplete(
      gl,
      this.passBFramebuffer,
      this.passBTexture,
      width,
      height
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.allocatedWidth = width;
    this.allocatedHeight = height;
  }

  private bindFullscreenQuad(program: WebGLProgram) {
    const { gl } = this;
    const positionLoc = gl.getAttribLocation(program, "aPosition");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
  }
}
