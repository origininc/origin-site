import {
  densityResolveFrag,
  densityResolveVert,
} from "@/shaders/densityResolve";
import {
  heightToNormalFrag,
  heightToNormalVert,
} from "@/shaders/heightToNormal";
import { copyFrag, copyVert, fieldBlurFrag, fieldBlurVert } from "./glsl";
import {
  bindFullscreenQuad,
  createFullscreenQuad,
  createProgram,
  createTexture,
} from "./webglUtils";

type RendererOptions = {
  blurRadius: number;
  densityGain: number;
  heightScale: number;
};

export class BoidFieldRenderer {
  private gl: WebGLRenderingContext;
  private quadBuffer: WebGLBuffer;

  private copyProgram: WebGLProgram;
  private blurProgram: WebGLProgram;
  private densityResolveProgram: WebGLProgram;
  private heightToNormalProgram: WebGLProgram;

  private sourceTexture: WebGLTexture;
  private passATexture: WebGLTexture;
  private passAFramebuffer: WebGLFramebuffer;
  private passBTexture: WebGLTexture;
  private passBFramebuffer: WebGLFramebuffer;

  private normalTexture: WebGLTexture;
  private normalFramebuffer: WebGLFramebuffer;

  private allocatedDensityWidth = 0;
  private allocatedDensityHeight = 0;

  private copyUniforms: {
    texture: WebGLUniformLocation | null;
  };

  private blurUniforms: {
    texture: WebGLUniformLocation | null;
    resolution: WebGLUniformLocation | null;
    direction: WebGLUniformLocation | null;
    blurRadius: WebGLUniformLocation | null;
  };

  private densityResolveUniforms: {
    texture: WebGLUniformLocation | null;
    densityGain: WebGLUniformLocation | null;
  };

  private heightToNormalUniforms: {
    texture: WebGLUniformLocation | null;
    resolution: WebGLUniformLocation | null;
    heightScale: WebGLUniformLocation | null;
  };

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;

    this.copyProgram = createProgram(gl, copyVert, copyFrag);
    this.blurProgram = createProgram(gl, fieldBlurVert, fieldBlurFrag);
    this.densityResolveProgram = createProgram(
      gl,
      densityResolveVert,
      densityResolveFrag
    );
    this.heightToNormalProgram = createProgram(
      gl,
      heightToNormalVert,
      heightToNormalFrag
    );

    this.quadBuffer = createFullscreenQuad(gl);

    this.sourceTexture = createTexture(gl);
    this.passATexture = createTexture(gl);
    this.passBTexture = createTexture(gl);
    this.normalTexture = createTexture(gl);

    this.passAFramebuffer = gl.createFramebuffer()!;
    this.passBFramebuffer = gl.createFramebuffer()!;
    this.normalFramebuffer = gl.createFramebuffer()!;

    this.copyUniforms = {
      texture: gl.getUniformLocation(this.copyProgram, "uTexture"),
    };

    this.blurUniforms = {
      texture: gl.getUniformLocation(this.blurProgram, "uTexture"),
      resolution: gl.getUniformLocation(this.blurProgram, "uResolution"),
      direction: gl.getUniformLocation(this.blurProgram, "uDirection"),
      blurRadius: gl.getUniformLocation(this.blurProgram, "uBlurRadius"),
    };

    this.densityResolveUniforms = {
      texture: gl.getUniformLocation(this.densityResolveProgram, "uTexture"),
      densityGain: gl.getUniformLocation(this.densityResolveProgram, "uDensityGain"),
    };

    this.heightToNormalUniforms = {
      texture: gl.getUniformLocation(this.heightToNormalProgram, "uTexture"),
      resolution: gl.getUniformLocation(this.heightToNormalProgram, "uResolution"),
      heightScale: gl.getUniformLocation(this.heightToNormalProgram, "uHeightScale"),
    };
  }

  allocate(width: number, height: number) {
    const gl = this.gl;

    this.allocatedDensityWidth = width;
    this.allocatedDensityHeight = height;

    gl.bindTexture(gl.TEXTURE_2D, this.passATexture);
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

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.passAFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.passATexture,
      0
    );

    let status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`passA framebuffer incomplete: ${status}`);
    }

    gl.bindTexture(gl.TEXTURE_2D, this.passBTexture);
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

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.passBFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.passBTexture,
      0
    );

    status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`passB framebuffer incomplete: ${status}`);
    }

    gl.bindTexture(gl.TEXTURE_2D, this.normalTexture);
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

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.normalFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.normalTexture,
      0
    );

    status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`normal framebuffer incomplete: ${status}`);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  readNormalPixels(): Uint8Array {
    const gl = this.gl;
    const { width, height } = this.getSize();
  
    if (width <= 0 || height <= 0) {
      return new Uint8Array(0);
    }
  
    const pixels = new Uint8Array(width * height * 4);
  
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.normalFramebuffer);
    gl.readPixels(
      0,
      0,
      width,
      height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  
    return pixels;
  }
  
  blitNormalToCanvas(targetCanvas: HTMLCanvasElement) {
    const { width, height } = this.getSize();
    if (width <= 0 || height <= 0) return;
  
    const pixels = this.readNormalPixels();
  
    targetCanvas.width = width;
    targetCanvas.height = height;
  
    const ctx = targetCanvas.getContext("2d");
    if (!ctx) return;
  
    const imageData = ctx.createImageData(width, height);
  
    for (let y = 0; y < height; y++) {
      const srcRow = height - 1 - y;
      const srcOffset = srcRow * width * 4;
      const dstOffset = y * width * 4;
      imageData.data.set(
        pixels.subarray(srcOffset, srcOffset + width * 4),
        dstOffset
      );
    }
  
    ctx.putImageData(imageData, 0, 0);
  }

  renderDensityAndNormal(params: {
    inputCanvas: HTMLCanvasElement;
    densityWidth: number;
    densityHeight: number;
    outputWidth: number;
    outputHeight: number;
    options: RendererOptions;
    previewNormal?: boolean;
  }) {
    const {
      inputCanvas,
      densityWidth,
      densityHeight,
      outputWidth,
      outputHeight,
      options,
      previewNormal = true,
    } = params;

    const gl = this.gl;

    if (
      densityWidth !== this.allocatedDensityWidth ||
      densityHeight !== this.allocatedDensityHeight
    ) {
      this.allocate(densityWidth, densityHeight);
    }

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      inputCanvas
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.passAFramebuffer);
    gl.viewport(0, 0, densityWidth, densityHeight);
    gl.useProgram(this.blurProgram);
    bindFullscreenQuad(gl, this.quadBuffer, this.blurProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.uniform1i(this.blurUniforms.texture, 0);
    gl.uniform2f(this.blurUniforms.resolution, densityWidth, densityHeight);
    gl.uniform2f(this.blurUniforms.direction, 1.0, 0.0);
    gl.uniform1f(this.blurUniforms.blurRadius, options.blurRadius);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.passBFramebuffer);
    gl.viewport(0, 0, densityWidth, densityHeight);
    gl.useProgram(this.blurProgram);
    bindFullscreenQuad(gl, this.quadBuffer, this.blurProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.passATexture);
    gl.uniform1i(this.blurUniforms.texture, 0);
    gl.uniform2f(this.blurUniforms.resolution, densityWidth, densityHeight);
    gl.uniform2f(this.blurUniforms.direction, 0.0, 1.0);
    gl.uniform1f(this.blurUniforms.blurRadius, options.blurRadius);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.passAFramebuffer);
    gl.viewport(0, 0, densityWidth, densityHeight);
    gl.useProgram(this.densityResolveProgram);
    bindFullscreenQuad(gl, this.quadBuffer, this.densityResolveProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.passBTexture);
    gl.uniform1i(this.densityResolveUniforms.texture, 0);
    gl.uniform1f(this.densityResolveUniforms.densityGain, options.densityGain);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.normalFramebuffer);
    gl.viewport(0, 0, densityWidth, densityHeight);
    gl.useProgram(this.heightToNormalProgram);
    bindFullscreenQuad(gl, this.quadBuffer, this.heightToNormalProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.passATexture);
    gl.uniform1i(this.heightToNormalUniforms.texture, 0);
    gl.uniform2f(this.heightToNormalUniforms.resolution, densityWidth, densityHeight);
    gl.uniform1f(this.heightToNormalUniforms.heightScale, options.heightScale);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (previewNormal) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, outputWidth, outputHeight);
      gl.useProgram(this.copyProgram);
      bindFullscreenQuad(gl, this.quadBuffer, this.copyProgram);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.normalTexture);
      gl.uniform1i(this.copyUniforms.texture, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, outputWidth, outputHeight);
    gl.useProgram(this.copyProgram);
    bindFullscreenQuad(gl, this.quadBuffer, this.copyProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.passATexture);
    gl.uniform1i(this.copyUniforms.texture, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  getNormalTexture() {
    return this.normalTexture;
  }

  getDensityTexture() {
    return this.passATexture;
  }

  getSize() {
    return {
      width: this.allocatedDensityWidth,
      height: this.allocatedDensityHeight,
    };
  }

  dispose() {
    const gl = this.gl;
    gl.deleteFramebuffer(this.passAFramebuffer);
    gl.deleteFramebuffer(this.passBFramebuffer);
    gl.deleteFramebuffer(this.normalFramebuffer);
    gl.deleteTexture(this.passATexture);
    gl.deleteTexture(this.passBTexture);
    gl.deleteTexture(this.normalTexture);
    gl.deleteTexture(this.sourceTexture);
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteProgram(this.copyProgram);
    gl.deleteProgram(this.blurProgram);
    gl.deleteProgram(this.densityResolveProgram);
    gl.deleteProgram(this.heightToNormalProgram);
  }
}