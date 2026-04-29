"use client";

import { useLayoutEffect, useState } from "react";

import {
  type CanvasRuntimeProfile,
  DESKTOP_CANVAS_RUNTIME,
  detectMobileCanvasRuntime,
  MOBILE_CANVAS_RUNTIME,
} from "@/lib/canvasRuntime";

export const useCanvasRuntimeProfile = () => {
  const [runtimeProfile, setRuntimeProfile] =
    useState<CanvasRuntimeProfile | null>(null);

  useLayoutEffect(() => {
    setRuntimeProfile(
      detectMobileCanvasRuntime()
        ? MOBILE_CANVAS_RUNTIME
        : DESKTOP_CANVAS_RUNTIME
    );
  }, []);

  return {
    isMobile: runtimeProfile?.isMobile ?? false,
    isReady: runtimeProfile !== null,
    profile: runtimeProfile,
  };
};
