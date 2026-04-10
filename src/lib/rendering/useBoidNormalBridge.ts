"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { BoidFieldRenderer } from "./boidFieldRenderer";

type UseBoidNormalBridgeArgs = {
  renderer: BoidFieldRenderer | null;
  enabled?: boolean;
};

export function useBoidNormalBridge({
  renderer,
  enabled = true,
}: UseBoidNormalBridgeArgs) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [normalTexture, setNormalTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.flipY = false;

    setNormalTexture(tex);

    return () => {
      tex.dispose();
      canvasRef.current = null;
      setNormalTexture(null);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !renderer || !normalTexture || !canvasRef.current) return;

    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);

      if (!canvasRef.current) return;

      renderer.blitNormalToCanvas(canvasRef.current);
      normalTexture.needsUpdate = true;
    };

    tick();

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [renderer, normalTexture, enabled]);

  return {
    normalTexture,
    normalCanvas: canvasRef.current,
  };
}