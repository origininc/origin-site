"use client";

import { useEffect, useState } from "react";

import {
  DESKTOP_CANVAS_RUNTIME,
  detectMobileCanvasRuntime,
  MOBILE_CANVAS_RUNTIME,
} from "@/lib/canvasRuntime";

export const useCanvasRuntimeProfile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(detectMobileCanvasRuntime());
  }, []);

  return isMobile ? MOBILE_CANVAS_RUNTIME : DESKTOP_CANVAS_RUNTIME;
};
