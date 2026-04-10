"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BoidFieldRenderer } from "@/lib/rendering/boidFieldRenderer";

type BoidFieldPassProps = {
  simCanvas: HTMLCanvasElement | null;
  densityScale?: number;
  blurRadius?: number;
  densityGain?: number;
  heightScale?: number;
  onNormalTexture?: (texture: THREE.Texture | null) => void;
};

export default function BoidFieldPass({
  simCanvas,
  densityScale = 0.5,
  blurRadius = 10,
  densityGain = 1,
  heightScale = 40,
  onNormalTexture,
}: BoidFieldPassProps) {
  const { gl, size } = useThree();

  const fieldRenderer = useMemo(() => {
    return new BoidFieldRenderer(gl.getContext());
  }, [gl]);

  const bridgeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const bridgeTexture = useMemo(() => {
    if (typeof document === "undefined") return null;

    const canvas = document.createElement("canvas");
    bridgeCanvasRef.current = canvas;

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.flipY = false;

    return tex;
  }, []);

  useEffect(() => {
    onNormalTexture?.(bridgeTexture ?? null);

    return () => {
      onNormalTexture?.(null);
      bridgeTexture?.dispose();
      fieldRenderer.dispose();
    };
  }, [bridgeTexture, fieldRenderer, onNormalTexture]);

  useFrame(() => {
    if (!simCanvas || !bridgeCanvasRef.current) return;

    const densityWidth = Math.max(1, Math.floor(simCanvas.width * densityScale));
    const densityHeight = Math.max(1, Math.floor(simCanvas.height * densityScale));

    fieldRenderer.renderDensityAndNormal({
      inputCanvas: simCanvas,
      densityWidth,
      densityHeight,
      options: {
        blurRadius,
        densityGain,
        heightScale,
      },
    });

    fieldRenderer.blitNormalToCanvas(bridgeCanvasRef.current);

    if (bridgeTexture) {
      bridgeTexture.needsUpdate = true;
    }

    gl.setRenderTarget(null);
    gl.setViewport(0, 0, size.width, size.height);
    gl.setScissorTest(false);
    gl.resetState();
  }, -1000);

  return null;
}