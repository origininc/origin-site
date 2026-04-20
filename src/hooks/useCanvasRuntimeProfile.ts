"use client";

import { useEffect, useState } from "react";

import {
  DESKTOP_CANVAS_RUNTIME,
  detectMobileCanvasRuntime,
  MOBILE_CANVAS_RUNTIME,
} from "@/lib/canvasRuntime";

export const useCanvasRuntimeProfile = () => {
  const [isMobile, setIsMobile] = useState(() => detectMobileCanvasRuntime());

  useEffect(() => {
    const queries = [
      window.matchMedia("(pointer: coarse)"),
      window.matchMedia("(max-width: 900px)"),
    ];

    const update = () => {
      setIsMobile(detectMobileCanvasRuntime());
    };

    update();

    queries.forEach((query) => {
      if ("addEventListener" in query) {
        query.addEventListener("change", update);
      } else {
        (
          query as MediaQueryList & {
            addListener: (listener: (event: MediaQueryListEvent) => void) => void;
          }
        ).addListener(update);
      }
    });

    window.addEventListener("orientationchange", update);

    return () => {
      queries.forEach((query) => {
        if ("removeEventListener" in query) {
          query.removeEventListener("change", update);
        } else {
          (
            query as MediaQueryList & {
              removeListener: (listener: (event: MediaQueryListEvent) => void) => void;
            }
          ).removeListener(update);
        }
      });
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return isMobile ? MOBILE_CANVAS_RUNTIME : DESKTOP_CANVAS_RUNTIME;
};
