"use client";

import Boids from "@/components/Boids";
import CymaticVisualizer from "@/components/CymaticVisualizer";
import {
  BOIDS_STUDIO_DENSITY_COUNTS,
  STUDIO_MODE_DEFAULT_PRESETS,
  STUDIO_MODE_LABELS,
  createDefaultBoidsStudioSettings,
  createDefaultCymaticsStudioSettings,
  type BoidsStudioSettings,
  type CymaticsStudioSettings,
  type StudioMode,
} from "@/lib/studioModes";
import {
  createStudioFxSettings,
  scaleStudioFxSettings,
  type StudioFxSettings,
} from "@/lib/studioFx";
import { StudioPostFxRenderer } from "@/lib/studioPostFxRenderer";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  type SetStateAction,
  type WheelEvent,
} from "react";

type LoadedImageAsset = {
  cleanupBitmap: ImageBitmap | null;
  exportHeight: number;
  exportSource: HTMLCanvasElement | ImageBitmap;
  exportWidth: number;
  fileName: string;
  originalHeight: number;
  originalWidth: number;
  previewDownscaled: boolean;
  previewSource: HTMLCanvasElement | ImageBitmap;
  textureLimited: boolean;
};

type StageSize = {
  height: number;
  width: number;
};

type SliderFieldProps = {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
};

type PassKey = "ascii" | "blur" | "chromatic" | "glow" | "vignette";

type ImageViewportState = {
  panX: number;
  panY: number;
  zoom: number;
};

const PREVIEW_PADDING = 36;
const PREVIEW_SOURCE_LIMIT = 2048;
const EXPORT_LONG_EDGE = 2048;
const CYMATICS_EXPORT_SIZE = 2048;
const IMAGE_PREVIEW_MIN_ZOOM = 1;
const IMAGE_PREVIEW_MAX_ZOOM = 2.5;
const IMAGE_PREVIEW_ZOOM_STEP = 0.12;
const DEFAULT_IMAGE_VIEWPORT: ImageViewportState = {
  panX: 0,
  panY: 0,
  zoom: 1,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const clampImageViewport = (
  viewport: ImageViewportState,
  stageWidth: number,
  stageHeight: number,
  width: number,
  height: number
): ImageViewportState => {
  const zoom = clamp(
    viewport.zoom,
    IMAGE_PREVIEW_MIN_ZOOM,
    IMAGE_PREVIEW_MAX_ZOOM
  );
  const scaledWidth = width * zoom;
  const scaledHeight = height * zoom;
  const maxPanX = Math.max(0, Math.abs(stageWidth - scaledWidth) / 2);
  const maxPanY = Math.max(0, Math.abs(stageHeight - scaledHeight) / 2);

  return {
    zoom,
    panX: clamp(viewport.panX, -maxPanX, maxPanX),
    panY: clamp(viewport.panY, -maxPanY, maxPanY),
  };
};

const gcd = (a: number, b: number): number => {
  let x = a;
  let y = b;

  while (y !== 0) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }

  return Math.max(1, x);
};

const getAspectLabel = (width: number, height: number) => {
  const divisor = gcd(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
};

const getSourceDimensions = (source: HTMLCanvasElement | ImageBitmap) => ({
  width: source.width,
  height: source.height,
});

const fitWithin = (
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
) => {
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);

  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
};

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to encode PNG from the current render."));
        return;
      }

      resolve(blob);
    }, "image/png");
  });

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const createSettingsBlob = (payload: unknown) =>
  new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });

const getImageDownloadName = (fileName: string) => {
  const lastDot = fileName.lastIndexOf(".");
  const baseName = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  return `${baseName}-shader.png`;
};

const getModeDownloadName = (mode: Exclude<StudioMode, "image">) =>
  `origin-studio-${mode === "boids" ? "creature" : mode}.png`;

const getSettingsDownloadName = (mode: StudioMode) =>
  `origin-studio-${mode === "boids" ? "creature" : mode}-settings.json`;

const getNumberDigits = (step: number) => {
  const parts = `${step}`.split(".");
  return parts[1]?.length ?? 0;
};

const drawScaledCanvas = (
  source: HTMLCanvasElement | ImageBitmap,
  width: number,
  height: number
) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to allocate 2D canvas for image preparation.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);

  return canvas;
};

const loadImageAsset = async (
  file: File,
  maxTextureSize: number
): Promise<LoadedImageAsset> => {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image uploads are supported here.");
  }

  const decoded = await createImageBitmap(file);
  const originalWidth = decoded.width;
  const originalHeight = decoded.height;
  const originalCanvas = drawScaledCanvas(decoded, originalWidth, originalHeight);
  decoded.close();

  let exportSource: HTMLCanvasElement | ImageBitmap = originalCanvas;
  let exportWidth = originalWidth;
  let exportHeight = originalHeight;
  let cleanupBitmap: ImageBitmap | null = null;
  let textureLimited = false;

  if (originalWidth > maxTextureSize || originalHeight > maxTextureSize) {
    const safeSize = fitWithin(
      originalWidth,
      originalHeight,
      maxTextureSize,
      maxTextureSize
    );

    exportSource = drawScaledCanvas(
      originalCanvas,
      safeSize.width,
      safeSize.height
    );
    exportWidth = safeSize.width;
    exportHeight = safeSize.height;
    textureLimited = true;
  }

  let previewSource: HTMLCanvasElement | ImageBitmap = exportSource;
  let previewDownscaled = false;

  if (
    exportWidth > PREVIEW_SOURCE_LIMIT ||
    exportHeight > PREVIEW_SOURCE_LIMIT
  ) {
    const previewSize = fitWithin(
      exportWidth,
      exportHeight,
      PREVIEW_SOURCE_LIMIT,
      PREVIEW_SOURCE_LIMIT
    );

    previewSource = drawScaledCanvas(
      exportSource,
      previewSize.width,
      previewSize.height
    );
    previewDownscaled = true;
  }

  return {
    cleanupBitmap,
    exportHeight,
    exportSource,
    exportWidth,
    fileName: file.name,
    originalHeight,
    originalWidth,
    previewDownscaled,
    previewSource,
    textureLimited,
  };
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong in Origin Studio.";

const createGeneratorSnapshot = (
  source: HTMLCanvasElement,
  width: number,
  height: number
) => {
  const snapshot = document.createElement("canvas");
  snapshot.width = width;
  snapshot.height = height;

  const context = snapshot.getContext("2d");
  if (!context) {
    throw new Error("Unable to allocate export canvas.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);

  return snapshot;
};

function SliderField({
  label,
  max,
  min,
  onChange,
  step,
  value,
}: SliderFieldProps) {
  const digits = getNumberDigits(step);
  const span = Math.max(step, max - min);
  const percent = ((value - min) / span) * 100;

  const clampSliderValue = (nextValue: number) => {
    const clamped = Math.min(max, Math.max(min, nextValue));
    const stepped = Math.round((clamped - min) / step) * step + min;
    const precision = Math.max(0, digits + 2);
    return Number(stepped.toFixed(precision));
  };

  const setFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(rect.right, Math.max(rect.left, event.clientX));
    const ratio = rect.width > 0 ? (x - rect.left) / rect.width : 0;
    onChange(clampSliderValue(min + ratio * (max - min)));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setFromPointer(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.buttons & 1) !== 1) {
      return;
    }

    setFromPointer(event);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(clampSliderValue(value - step));
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(clampSliderValue(value + step));
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      onChange(min);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      onChange(max);
    }
  };

  return (
    <>
      <label className="sliderField">
        <span className="sliderLabel">{label}</span>
        <div
          className="sliderControl"
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={value.toFixed(digits)}
          onKeyDown={handleKeyDown}
        >
          <div
            className="sliderShell"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
          >
            <span className="sliderRail" />
            <span
              className="sliderThumb"
              style={{ left: `calc(${percent}% - 7px)` }}
            />
            <span
              className="sliderValue"
              style={{ left: `calc(${percent}% - 24px)` }}
            >
              {value.toFixed(digits)}
            </span>
          </div>
        </div>
      </label>

      <style jsx>{`
        .sliderField {
          display: grid;
          grid-template-columns: minmax(126px, auto) minmax(0, 1fr);
          gap: 16px;
          align-items: start;
        }

        .sliderLabel {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.74);
          padding-top: 1px;
        }

        .sliderControl {
          position: relative;
          display: flex;
          align-items: flex-start;
          outline: none;
          min-height: 38px;
        }

        .sliderControl:focus-visible .sliderShell {
          border-color: #fff;
        }

        .sliderShell {
          position: relative;
          display: flex;
          align-items: center;
          flex: 1 1 auto;
          width: 100%;
          height: 8px;
          margin-top: 5px;
          border: 0.5px solid rgba(255, 255, 255, 0.72);
          background: #000;
          cursor: pointer;
          user-select: none;
          overflow: visible;
        }

        .sliderRail {
          position: absolute;
          inset: 0;
          background: #000;
          z-index: 0;
        }

        .sliderThumb {
          position: absolute;
          top: -4px;
          width: 14px;
          height: 14px;
          border: 1px solid #fff;
          background: #fff;
          pointer-events: none;
          z-index: 2;
        }

        .sliderValue {
          position: absolute;
          top: 16px;
          width: 48px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.8);
          text-align: center;
          pointer-events: none;
          z-index: 1;
        }

        @media (max-width: 980px) {
          .sliderField {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }
      `}</style>
    </>
  );
}

export default function OriginStudio() {
  const [mode, setMode] = useState<StudioMode>("image");
  const [imageFxSettings, setImageFxSettings] = useState<StudioFxSettings>(() =>
    createStudioFxSettings(STUDIO_MODE_DEFAULT_PRESETS.image)
  );
  const [boidsFxSettings, setBoidsFxSettings] = useState<StudioFxSettings>(() =>
    createStudioFxSettings(STUDIO_MODE_DEFAULT_PRESETS.boids)
  );
  const [cymaticsFxSettings, setCymaticsFxSettings] =
    useState<StudioFxSettings>(() =>
      createStudioFxSettings(STUDIO_MODE_DEFAULT_PRESETS.cymatics)
    );
  const [imageAsset, setImageAsset] = useState<LoadedImageAsset | null>(null);
  const [imageViewport, setImageViewport] =
    useState<ImageViewportState>(DEFAULT_IMAGE_VIEWPORT);
  const [isImagePanning, setIsImagePanning] = useState(false);
  const [boidsSettings, setBoidsSettings] = useState<BoidsStudioSettings>(() =>
    createDefaultBoidsStudioSettings()
  );
  const [cymaticsSettings, setCymaticsSettings] =
    useState<CymaticsStudioSettings>(() => createDefaultCymaticsStudioSettings());
  const [stageSize, setStageSize] = useState<StageSize>({ width: 0, height: 0 });
  const [maxTextureSize, setMaxTextureSize] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rendererRef = useRef<StudioPostFxRenderer | null>(null);
  const imageAssetRef = useRef<LoadedImageAsset | null>(null);
  const imagePanSessionRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const boidsSourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cymaticsSourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageInteractionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) {
      return;
    }

    try {
      const renderer = new StudioPostFxRenderer(canvas);
      rendererRef.current = renderer;
      setMaxTextureSize(renderer.getMaxTextureSize());
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }

    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;

      const currentAsset = imageAssetRef.current;
      if (currentAsset?.cleanupBitmap) {
        currentAsset.cleanupBitmap.close();
      }
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setStageSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(stage);
    return () => {
      observer.disconnect();
    };
  }, []);

  const activeFxSettings =
    mode === "image"
      ? imageFxSettings
      : mode === "boids"
        ? boidsFxSettings
        : cymaticsFxSettings;

  const previewSurfaceSize = useMemo(() => {
    const paddedWidth = Math.max(1, stageSize.width - PREVIEW_PADDING * 2);
    const paddedHeight = Math.max(1, stageSize.height - PREVIEW_PADDING * 2);

    if (mode === "image") {
      if (!imageAsset) {
        return { width: 0, height: 0 };
      }

      const sourceSize = getSourceDimensions(imageAsset.previewSource);
      return fitWithin(
        sourceSize.width,
        sourceSize.height,
        paddedWidth,
        paddedHeight
      );
    }

    if (mode === "boids") {
      return {
        width: paddedWidth,
        height: paddedHeight,
      };
    }

    const side = Math.max(1, Math.min(stageSize.width, stageSize.height));
    return { width: side, height: side };
  }, [imageAsset, mode, stageSize.height, stageSize.width]);

  const sourceNotice = useMemo(() => {
    if (mode !== "image" || !imageAsset) {
      return null;
    }

    if (imageAsset.textureLimited) {
      return `Original image exceeded the browser's WebGL texture limit. Preview and export are using a safe render size of ${imageAsset.exportWidth}×${imageAsset.exportHeight}.`;
    }

    if (imageAsset.previewDownscaled) {
      return "Preview is using a lighter working image for speed. Export will still render at the original upload resolution.";
    }

    return null;
  }, [imageAsset, mode]);

  const replaceAsset = (nextAsset: LoadedImageAsset | null) => {
    const previousAsset = imageAssetRef.current;
    if (previousAsset?.cleanupBitmap) {
      previousAsset.cleanupBitmap.close();
    }

    imageAssetRef.current = nextAsset;
    setImageAsset(nextAsset);
    setImageViewport(DEFAULT_IMAGE_VIEWPORT);
    setIsImagePanning(false);
    imagePanSessionRef.current = null;
  };

  useEffect(() => {
    if (mode !== "image") {
      setIsImagePanning(false);
      imagePanSessionRef.current = null;
      return;
    }

    setImageViewport((previous) =>
      clampImageViewport(
        previous,
        stageSize.width,
        stageSize.height,
        previewSurfaceSize.width,
        previewSurfaceSize.height
      )
    );
  }, [
    mode,
    previewSurfaceSize.height,
    previewSurfaceSize.width,
    stageSize.height,
    stageSize.width,
  ]);

  const handleImageFile = async (file: File | null) => {
    if (!file) {
      return;
    }

    if (!maxTextureSize) {
      setErrorMessage("WebGL preview is still initializing.");
      return;
    }

    setIsLoadingImage(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextAsset = await loadImageAsset(file, maxTextureSize);
      replaceAsset(nextAsset);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoadingImage(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    await handleImageFile(file);
    event.target.value = "";
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (mode !== "image") {
      return;
    }

    event.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (mode !== "image") {
      return;
    }

    event.preventDefault();
    setDragActive(false);
  };

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    if (mode !== "image") {
      return;
    }

    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    await handleImageFile(file);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const resetImageViewport = () => {
    setImageViewport(DEFAULT_IMAGE_VIEWPORT);
    setIsImagePanning(false);
    imagePanSessionRef.current = null;
  };

  const handleImageWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    if (mode !== "image" || !imageAsset) {
      return;
    }

    event.preventDefault();

    const zoomDelta = event.deltaY < 0
      ? IMAGE_PREVIEW_ZOOM_STEP
      : -IMAGE_PREVIEW_ZOOM_STEP;

    setImageViewport((previous) =>
      clampImageViewport(
        {
          ...previous,
          zoom: previous.zoom + zoomDelta,
        },
        stageSize.width,
        stageSize.height,
        previewSurfaceSize.width,
        previewSurfaceSize.height
      )
    );
  };

  const handleImagePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (mode !== "image" || !imageAsset) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    imagePanSessionRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: imageViewport.panX,
      startPanY: imageViewport.panY,
    };
    setIsImagePanning(true);
  };

  const handleImagePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const session = imagePanSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    setImageViewport((previous) =>
      clampImageViewport(
        {
          ...previous,
          panX: session.startPanX + (event.clientX - session.startClientX),
          panY: session.startPanY + (event.clientY - session.startClientY),
        },
        stageSize.width,
        stageSize.height,
        previewSurfaceSize.width,
        previewSurfaceSize.height
      )
    );
  };

  const endImagePan = (event?: PointerEvent<HTMLCanvasElement>) => {
    if (
      event &&
      imagePanSessionRef.current &&
      imagePanSessionRef.current.pointerId !== event.pointerId
    ) {
      return;
    }

    imagePanSessionRef.current = null;
    setIsImagePanning(false);
  };

  const updateCurrentFxSettings = (
    updater: (previous: StudioFxSettings) => StudioFxSettings
  ) => {
    const updateAndClear = (
      setter: Dispatch<SetStateAction<StudioFxSettings>>
    ) => {
      setter((previous) => updater(previous));
      setStatusMessage(null);
    };

    if (mode === "image") {
      updateAndClear(setImageFxSettings);
      return;
    }

    if (mode === "boids") {
      updateAndClear(setBoidsFxSettings);
      return;
    }

    updateAndClear(setCymaticsFxSettings);
  };

  const resetCurrentMode = () => {
    if (mode === "image") {
      replaceAsset(null);
      setImageFxSettings(createStudioFxSettings(STUDIO_MODE_DEFAULT_PRESETS.image));
      setErrorMessage(null);
      setStatusMessage("Reset image mode.");
      return;
    }

    if (mode === "boids") {
      setBoidsSettings(createDefaultBoidsStudioSettings());
      setBoidsFxSettings(createStudioFxSettings(STUDIO_MODE_DEFAULT_PRESETS.boids));
      setStatusMessage("Reset creature mode.");
      return;
    }

    setCymaticsSettings(createDefaultCymaticsStudioSettings());
    setCymaticsFxSettings(
      createStudioFxSettings(STUDIO_MODE_DEFAULT_PRESETS.cymatics)
    );
    setStatusMessage("Reset cymatics mode.");
  };

  const updatePassEnabled = (pass: PassKey, enabled: boolean) => {
    updateCurrentFxSettings((previous) => {
      const next = structuredClone(previous);
      next[pass].enabled = enabled;
      return next;
    });
  };

  const updatePassUniform = (pass: PassKey, key: string, value: number) => {
    updateCurrentFxSettings((previous) => {
      const next = structuredClone(previous);
      (next[pass].uniforms as Record<string, number>)[key] = value;
      return next;
    });
  };

  const updateBoidsSetting = <K extends keyof BoidsStudioSettings>(
    key: K,
    value: BoidsStudioSettings[K]
  ) => {
    setBoidsSettings((previous) => ({
      ...previous,
      [key]: value,
    }));
    setStatusMessage(null);
  };

  const updateCymaticsSetting = <K extends keyof CymaticsStudioSettings>(
    key: K,
    value: CymaticsStudioSettings[K]
  ) => {
    setCymaticsSettings((previous) => ({
      ...previous,
      [key]: value,
    }));
    setStatusMessage(null);
  };

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }

    if (previewSurfaceSize.width <= 0 || previewSurfaceSize.height <= 0) {
      return;
    }

    const getSource = () => {
      if (mode === "image") {
        return imageAsset?.previewSource ?? null;
      }

      if (mode === "boids") {
        return boidsSourceCanvasRef.current;
      }

      return cymaticsSourceCanvasRef.current;
    };

    let raf = 0;
    let cancelled = false;

    const renderFrame = () => {
      if (cancelled) {
        return;
      }

      const source = getSource();
      if (source) {
        try {
          renderer.render({
            source,
            renderWidth: previewSurfaceSize.width,
            renderHeight: previewSurfaceSize.height,
            settings: activeFxSettings,
          });
          setErrorMessage((previous) => (previous ? null : previous));
        } catch (error) {
          setErrorMessage(getErrorMessage(error));
        }
      }

      if (mode !== "image") {
        raf = requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [
    activeFxSettings,
    imageAsset,
    mode,
    previewSurfaceSize.height,
    previewSurfaceSize.width,
  ]);

  const handleExport = async () => {
    if (!rendererRef.current) {
      return;
    }

    setIsExporting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const exportCanvas = document.createElement("canvas");
    let exportRenderer: StudioPostFxRenderer | null = null;

    try {
      exportRenderer = new StudioPostFxRenderer(exportCanvas);

      if (mode === "image") {
        if (!imageAsset) {
          return;
        }

        const effectScale =
          previewSurfaceSize.width > 0
            ? imageAsset.exportWidth / previewSurfaceSize.width
            : 1;

        exportRenderer.render({
          source: imageAsset.exportSource,
          renderWidth: imageAsset.exportWidth,
          renderHeight: imageAsset.exportHeight,
          settings: scaleStudioFxSettings(imageFxSettings, effectScale),
        });

        const blob = await canvasToBlob(exportCanvas);
        downloadBlob(blob, getImageDownloadName(imageAsset.fileName));
        setStatusMessage(
          imageAsset.textureLimited
            ? `PNG exported at safe size ${imageAsset.exportWidth}×${imageAsset.exportHeight}.`
            : `PNG exported at ${imageAsset.originalWidth}×${imageAsset.originalHeight}.`
        );
        return;
      }

      if (previewSurfaceSize.width <= 0 || previewSurfaceSize.height <= 0) {
        throw new Error("Preview has not initialized yet.");
      }

      if (mode === "boids") {
        const source = boidsSourceCanvasRef.current;
        if (!source) {
          throw new Error("Creature source is not ready yet.");
        }

        const scale = EXPORT_LONG_EDGE /
          Math.max(previewSurfaceSize.width, previewSurfaceSize.height);
        const requestedWidth = Math.max(
          1,
          Math.round(previewSurfaceSize.width * scale)
        );
        const requestedHeight = Math.max(
          1,
          Math.round(previewSurfaceSize.height * scale)
        );
        const safeExportSize = fitWithin(
          requestedWidth,
          requestedHeight,
          exportRenderer.getMaxTextureSize(),
          exportRenderer.getMaxTextureSize()
        );
        const exportWidth = safeExportSize.width;
        const exportHeight = safeExportSize.height;
        const snapshot = createGeneratorSnapshot(source, exportWidth, exportHeight);

        exportRenderer.render({
          source: snapshot,
          renderWidth: exportWidth,
          renderHeight: exportHeight,
          settings: scaleStudioFxSettings(boidsFxSettings, scale),
        });

        const blob = await canvasToBlob(exportCanvas);
        downloadBlob(blob, getModeDownloadName("boids"));
        setStatusMessage(`PNG exported at ${exportWidth}×${exportHeight}.`);
        return;
      }

      const source = cymaticsSourceCanvasRef.current;
      if (!source) {
        throw new Error("Cymatics source is not ready yet.");
      }

      const safeExportSize = fitWithin(
        CYMATICS_EXPORT_SIZE,
        CYMATICS_EXPORT_SIZE,
        exportRenderer.getMaxTextureSize(),
        exportRenderer.getMaxTextureSize()
      );
      const snapshot = createGeneratorSnapshot(
        source,
        safeExportSize.width,
        safeExportSize.height
      );
      const scale =
        safeExportSize.width / Math.max(1, previewSurfaceSize.width);

      exportRenderer.render({
        source: snapshot,
        renderWidth: safeExportSize.width,
        renderHeight: safeExportSize.height,
        settings: scaleStudioFxSettings(cymaticsFxSettings, scale),
      });

      const blob = await canvasToBlob(exportCanvas);
      downloadBlob(blob, getModeDownloadName("cymatics"));
      setStatusMessage(
        `PNG exported at ${safeExportSize.width}×${safeExportSize.height}.`
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      exportRenderer?.dispose();
      setIsExporting(false);
    }
  };

  const handleExportSettings = () => {
    const settingsPayload =
      mode === "image"
        ? {
            version: 1,
            exportedAt: new Date().toISOString(),
            mode,
            fxSettings: structuredClone(imageFxSettings),
            imageViewport: structuredClone(imageViewport),
            imageMetadata: imageAsset
              ? {
                  fileName: imageAsset.fileName,
                  originalWidth: imageAsset.originalWidth,
                  originalHeight: imageAsset.originalHeight,
                  exportWidth: imageAsset.exportWidth,
                  exportHeight: imageAsset.exportHeight,
                  textureLimited: imageAsset.textureLimited,
                  previewDownscaled: imageAsset.previewDownscaled,
                }
              : null,
          }
        : mode === "boids"
          ? {
              version: 1,
              exportedAt: new Date().toISOString(),
              mode,
              sourceSettings: structuredClone(boidsSettings),
              fxSettings: structuredClone(boidsFxSettings),
            }
          : {
              version: 1,
              exportedAt: new Date().toISOString(),
              mode,
              sourceSettings: structuredClone(cymaticsSettings),
              fxSettings: structuredClone(cymaticsFxSettings),
            };

    downloadBlob(createSettingsBlob(settingsPayload), getSettingsDownloadName(mode));
    setErrorMessage(null);
    setStatusMessage(
      `Settings exported for ${mode === "boids" ? "creature" : mode}.`
    );
  };

  const metadataRows = useMemo(() => {
    if (mode === "image") {
      if (!imageAsset) {
        return null;
      }

      return [
        { label: "File", value: imageAsset.fileName },
        {
          label: "Original",
          value: `${imageAsset.originalWidth}×${imageAsset.originalHeight}`,
        },
        {
          label: "Aspect",
          value: getAspectLabel(imageAsset.originalWidth, imageAsset.originalHeight),
        },
        {
          label: "Export",
          value: `${imageAsset.exportWidth}×${imageAsset.exportHeight}`,
        },
      ];
    }

    if (mode === "boids") {
      return [
        {
          label: "Density",
          value: `${BOIDS_STUDIO_DENSITY_COUNTS[boidsSettings.densityIndex]}`,
        },
        {
          label: "Preview",
          value: `${Math.round(previewSurfaceSize.width)}×${Math.round(
            previewSurfaceSize.height
          )}`,
        },
        {
          label: "Aspect",
          value: getAspectLabel(
            Math.max(1, Math.round(previewSurfaceSize.width)),
            Math.max(1, Math.round(previewSurfaceSize.height))
          ),
        },
        {
          label: "Export",
          value: `Long edge ${EXPORT_LONG_EDGE}px`,
        },
      ];
    }

    return [
      {
        label: "Harmonics",
        value: `n ${cymaticsSettings.harmonicN} / m ${cymaticsSettings.harmonicM}`,
      },
      {
        label: "Base Color",
        value: `rgb(${Math.round(cymaticsSettings.baseRed)}, ${Math.round(
          cymaticsSettings.baseGreen
        )}, ${Math.round(cymaticsSettings.baseBlue)})`,
      },
      {
        label: "Preview",
        value: `${Math.round(previewSurfaceSize.width)}×${Math.round(
          previewSurfaceSize.height
        )}`,
      },
      {
        label: "Particles",
        value: `${cymaticsSettings.particleDensity.toFixed(2)}x`,
      },
      {
        label: "Export",
        value: `${CYMATICS_EXPORT_SIZE}×${CYMATICS_EXPORT_SIZE}`,
      },
    ];
  }, [
    boidsSettings.densityIndex,
    cymaticsSettings.baseBlue,
    cymaticsSettings.baseGreen,
    cymaticsSettings.baseRed,
    cymaticsSettings.harmonicM,
    cymaticsSettings.harmonicN,
    cymaticsSettings.particleDensity,
    imageAsset,
    mode,
    previewSurfaceSize.height,
    previewSurfaceSize.width,
  ]);

  const previewCanvasTransform =
    mode === "image" && imageAsset
      ? `translate(calc(-50% + ${imageViewport.panX}px), calc(-50% + ${imageViewport.panY}px)) scale(${imageViewport.zoom})`
      : "translate(-50%, -50%)";

  return (
    <main className="shell">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
        onChange={handleFileChange}
        hidden
      />

      <header className="topbar">
        <div>
          <h1 className="title">Origin Studio</h1>
          <p className="eyebrow">Pipeline Editor</p>
        </div>

        <form action="/client/studio/logout" method="post">
          <button type="submit" className="ghostButton">
            Log out
          </button>
        </form>
      </header>

      <div className="workspace">
        <section className="previewColumn">
          <div
            ref={(node) => {
              stageRef.current = node;
              stageInteractionRef.current = node;
            }}
            className={`stage ${dragActive ? "stageActive" : ""} ${
              mode === "image" ? "" : "stageBlack"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={mode === "image" && !imageAsset ? openFilePicker : undefined}
          >
            {mode === "boids" && previewSurfaceSize.width > 0 && previewSurfaceSize.height > 0 ? (
              <div
                className="sourceMount"
                style={{
                  width: previewSurfaceSize.width,
                  height: previewSurfaceSize.height,
                }}
              >
                <Boids
                  renderMode="source"
                  sourceCanvasRef={boidsSourceCanvasRef}
                  interactionTargetRef={stageInteractionRef}
                  studioSettings={boidsSettings}
                />
              </div>
            ) : null}

            {mode === "cymatics" && previewSurfaceSize.width > 0 ? (
              <div
                className="sourceMount"
                style={{
                  width: previewSurfaceSize.width,
                  height: previewSurfaceSize.height,
                }}
              >
                <CymaticVisualizer
                  value={1}
                  renderMode="source"
                  sourceCanvasRef={cymaticsSourceCanvasRef}
                  studioSettings={cymaticsSettings}
                />
              </div>
            ) : null}

            <canvas
              ref={previewCanvasRef}
              className={`previewCanvas ${
                mode === "image" && imageAsset ? "previewCanvasInteractive" : ""
              } ${
                previewSurfaceSize.width > 0 && previewSurfaceSize.height > 0
                  ? ""
                  : "previewCanvasHidden"
              }`}
              onWheel={mode === "image" && imageAsset ? handleImageWheel : undefined}
              onPointerDown={
                mode === "image" && imageAsset ? handleImagePointerDown : undefined
              }
              onPointerMove={
                mode === "image" && imageAsset ? handleImagePointerMove : undefined
              }
              onPointerUp={
                mode === "image" && imageAsset ? endImagePan : undefined
              }
              onPointerCancel={
                mode === "image" && imageAsset ? endImagePan : undefined
              }
              onDoubleClick={
                mode === "image" && imageAsset ? resetImageViewport : undefined
              }
              style={
                previewSurfaceSize.width > 0 && previewSurfaceSize.height > 0
                  ? {
                      cursor:
                        mode === "image" && imageAsset
                          ? isImagePanning
                            ? "grabbing"
                            : "grab"
                          : "default",
                      touchAction:
                        mode === "image" && imageAsset ? "none" : "auto",
                      transform: previewCanvasTransform,
                      width: previewSurfaceSize.width,
                      height: previewSurfaceSize.height,
                    }
                  : undefined
              }
            />

            {mode === "image" && !imageAsset ? (
              <div className="emptyState">
                <p className="emptyTitle">Drop an image here</p>
                <p className="emptyBody">
                  PNG, JPG, WebP, AVIF, and GIF stills are supported.
                </p>
                <button
                  type="button"
                  className="primaryButton"
                  onClick={(event) => {
                    event.stopPropagation();
                    openFilePicker();
                  }}
                >
                  Choose image
                </button>
              </div>
            ) : null}

            {dragActive && mode === "image" && imageAsset ? (
              <div className="dropOverlay">Drop to replace image</div>
            ) : null}

            {isLoadingImage ? <div className="busyPill">Loading image…</div> : null}

            {mode === "image" && imageAsset ? (
              <div className="hintPill">
                Drag to pan. Scroll to zoom. Double click to reset.
              </div>
            ) : null}

            {mode === "boids" ? (
              <div className="hintPill">Left click to flee. Right click to seek.</div>
            ) : null}
          </div>
        </section>

        <aside className="panel">
          <section className="card actionsCard">
            <div className="buttonRow">
              <button type="button" className="secondaryButton" onClick={resetCurrentMode}>
                Reset
              </button>
              <button
                type="button"
                className="secondaryButton"
                onClick={handleExportSettings}
              >
                Export Settings
              </button>
              <button
                type="button"
                className="secondaryButton"
                onClick={handleExport}
                disabled={
                  isExporting ||
                  (mode === "image" && !imageAsset) ||
                  previewSurfaceSize.width <= 0
                }
              >
                {isExporting ? "Exporting…" : "Export PNG"}
              </button>
            </div>

            {statusMessage ? <p className="status ok">{statusMessage}</p> : null}
            {sourceNotice ? <p className="status">{sourceNotice}</p> : null}
            {errorMessage ? <p className="status error">{errorMessage}</p> : null}
          </section>

          <section className="card">
            <div className="sectionHeader">
              <p className="sectionEyebrow">Mode</p>
            </div>
            <div className="presetGrid">
              {(Object.keys(STUDIO_MODE_LABELS) as StudioMode[]).map((modeId) => (
                <button
                  key={modeId}
                  type="button"
                  className={`presetButton ${mode === modeId ? "presetButtonActive" : ""}`}
                  onClick={() => setMode(modeId)}
                >
                  {STUDIO_MODE_LABELS[modeId]}
                </button>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="sectionHeader">
              <p className="sectionEyebrow">
                {mode === "image"
                  ? "Image"
                  : mode === "boids"
                    ? "Creature"
                    : "Cymatics"}
              </p>
            </div>

            {metadataRows ? (
              <dl className="metadata">
                {metadataRows.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="metadataEmpty">
                No image loaded yet. The current preset and shader settings will
                apply as soon as you upload one.
              </p>
            )}
          </section>

          {mode === "boids" ? (
            <section className="card passCard">
              <div className="sectionHeader">
                <p className="sectionEyebrow">Cells</p>
              </div>

              <div className="choiceField">
                <span className="choiceLabel">Density</span>
                <div className="choiceGrid">
                  {BOIDS_STUDIO_DENSITY_COUNTS.map((count, index) => (
                    <button
                      key={count}
                      type="button"
                      className={`choiceButton ${
                        boidsSettings.densityIndex === index ? "choiceButtonActive" : ""
                      }`}
                      onClick={() => updateBoidsSetting("densityIndex", index)}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <SliderField
                label="Speed"
                min={0.5}
                max={1.8}
                step={0.05}
                value={boidsSettings.speed}
                onChange={(value) => updateBoidsSetting("speed", value)}
              />
              <SliderField
                label="Flocking"
                min={0}
                max={2}
                step={0.05}
                value={boidsSettings.flocking}
                onChange={(value) => updateBoidsSetting("flocking", value)}
              />
              <SliderField
                label="Separation"
                min={0.5}
                max={2.5}
                step={0.05}
                value={boidsSettings.separation}
                onChange={(value) => updateBoidsSetting("separation", value)}
              />
              <SliderField
                label="Size"
                min={2}
                max={10}
                step={0.5}
                value={boidsSettings.size}
                onChange={(value) => updateBoidsSetting("size", value)}
              />
            </section>
          ) : null}

          {mode === "cymatics" ? (
            <section className="card passCard">
              <div className="sectionHeader">
                <p className="sectionEyebrow">Cymatics</p>
              </div>

              <SliderField
                label="Harmonic N"
                min={1}
                max={8}
                step={1}
                value={cymaticsSettings.harmonicN}
                onChange={(value) => updateCymaticsSetting("harmonicN", value)}
              />
              <SliderField
                label="Harmonic M"
                min={1}
                max={8}
                step={1}
                value={cymaticsSettings.harmonicM}
                onChange={(value) => updateCymaticsSetting("harmonicM", value)}
              />
              <SliderField
                label="Base Red"
                min={0}
                max={255}
                step={1}
                value={cymaticsSettings.baseRed}
                onChange={(value) => updateCymaticsSetting("baseRed", value)}
              />
              <SliderField
                label="Base Green"
                min={0}
                max={255}
                step={1}
                value={cymaticsSettings.baseGreen}
                onChange={(value) => updateCymaticsSetting("baseGreen", value)}
              />
              <SliderField
                label="Base Blue"
                min={0}
                max={255}
                step={1}
                value={cymaticsSettings.baseBlue}
                onChange={(value) => updateCymaticsSetting("baseBlue", value)}
              />
              <SliderField
                label="Particle Density"
                min={0.5}
                max={2.5}
                step={0.05}
                value={cymaticsSettings.particleDensity}
                onChange={(value) => updateCymaticsSetting("particleDensity", value)}
              />
              <SliderField
                label="Node Pull"
                min={0}
                max={1}
                step={0.01}
                value={cymaticsSettings.nodePull}
                onChange={(value) => updateCymaticsSetting("nodePull", value)}
              />
              <SliderField
                label="Hue Shift"
                min={0}
                max={0.8}
                step={0.01}
                value={cymaticsSettings.hueShift}
                onChange={(value) => updateCymaticsSetting("hueShift", value)}
              />
            </section>
          ) : null}

          <section className="card passCard">
            <div className="passHeader">
              <div>
                <p className="sectionEyebrow">Horizontal Blur</p>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={activeFxSettings.blur.enabled}
                  onChange={(event) =>
                    updatePassEnabled("blur", event.target.checked)
                  }
                />
                <span>Enabled</span>
              </label>
            </div>
            <SliderField
              label="Blur Amount"
              min={0}
              max={16}
              step={0.1}
              value={activeFxSettings.blur.uniforms.blurAmount}
              onChange={(value) => updatePassUniform("blur", "blurAmount", value)}
            />
          </section>

          <section className="card passCard">
            <div className="passHeader">
              <div>
                <p className="sectionEyebrow">ASCII</p>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={activeFxSettings.ascii.enabled}
                  onChange={(event) =>
                    updatePassEnabled("ascii", event.target.checked)
                  }
                />
                <span>Enabled</span>
              </label>
            </div>
            <SliderField
              label="Pixelation"
              min={0.4}
              max={4}
              step={0.1}
              value={activeFxSettings.ascii.uniforms.pixelation}
              onChange={(value) =>
                updatePassUniform("ascii", "pixelation", Math.round(value * 10) / 10)
              }
            />
            <SliderField
              label="Saturation"
              min={0}
              max={2.5}
              step={0.05}
              value={activeFxSettings.ascii.uniforms.saturation}
              onChange={(value) =>
                updatePassUniform(
                  "ascii",
                  "saturation",
                  Math.round(value * 100) / 100
                )
              }
            />
          </section>

          <section className="card passCard">
            <div className="passHeader">
              <div>
                <p className="sectionEyebrow">Chromatic Aberration</p>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={activeFxSettings.chromatic.enabled}
                  onChange={(event) =>
                    updatePassEnabled("chromatic", event.target.checked)
                  }
                />
                <span>Enabled</span>
              </label>
            </div>
            <SliderField
              label="Strength"
              min={0}
              max={0.02}
              step={0.0005}
              value={activeFxSettings.chromatic.uniforms.strength}
              onChange={(value) => updatePassUniform("chromatic", "strength", value)}
            />
          </section>

          <section className="card passCard">
            <div className="passHeader">
              <div>
                <p className="sectionEyebrow">Radial Glow</p>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={activeFxSettings.glow.enabled}
                  onChange={(event) =>
                    updatePassEnabled("glow", event.target.checked)
                  }
                />
                <span>Enabled</span>
              </label>
            </div>
            <SliderField
              label="Glow Strength"
              min={0}
              max={4}
              step={0.05}
              value={activeFxSettings.glow.uniforms.glowStrength}
              onChange={(value) => updatePassUniform("glow", "glowStrength", value)}
            />
            <SliderField
              label="Glow Radius"
              min={0}
              max={18}
              step={0.1}
              value={activeFxSettings.glow.uniforms.glowRadius}
              onChange={(value) => updatePassUniform("glow", "glowRadius", value)}
            />
            <SliderField
              label="Radial Strength"
              min={0}
              max={4}
              step={0.05}
              value={activeFxSettings.glow.uniforms.radialStrength}
              onChange={(value) => updatePassUniform("glow", "radialStrength", value)}
            />
            <SliderField
              label="Radial Falloff"
              min={0.4}
              max={3}
              step={0.05}
              value={activeFxSettings.glow.uniforms.radialFalloff}
              onChange={(value) => updatePassUniform("glow", "radialFalloff", value)}
            />
          </section>

          <section className="card passCard">
            <div className="passHeader">
              <div>
                <p className="sectionEyebrow">Vignette</p>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={activeFxSettings.vignette.enabled}
                  onChange={(event) =>
                    updatePassEnabled("vignette", event.target.checked)
                  }
                />
                <span>Enabled</span>
              </label>
            </div>
            <SliderField
              label="Strength"
              min={0}
              max={5}
              step={0.05}
              value={activeFxSettings.vignette.uniforms.strength}
              onChange={(value) => updatePassUniform("vignette", "strength", value)}
            />
            <SliderField
              label="Power"
              min={0.4}
              max={3}
              step={0.05}
              value={activeFxSettings.vignette.uniforms.power}
              onChange={(value) => updatePassUniform("vignette", "power", value)}
            />
            <SliderField
              label="Zoom"
              min={0.6}
              max={2.5}
              step={0.05}
              value={activeFxSettings.vignette.uniforms.zoom}
              onChange={(value) => updatePassUniform("vignette", "zoom", value)}
            />
          </section>
        </aside>
      </div>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          padding: 28px;
          background: #000;
          color: #fff;
        }

        .topbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .eyebrow {
          font-size: 12px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.56);
          margin-bottom: 10px;
        }

        .title {
          font-size: clamp(28px, 4vw, 44px);
          font-weight: 500;
          line-height: 0.96;
          margin-bottom: 12px;
        }

        .ghostButton,
        .primaryButton,
        .secondaryButton,
        .presetButton,
        .choiceButton {
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: transparent;
          color: #fff;
          font: inherit;
          cursor: pointer;
          transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
        }

        .ghostButton {
          padding: 12px 16px;
        }

        .primaryButton {
          background: #fff;
          color: #000;
          padding: 12px 16px;
        }

        .secondaryButton {
          padding: 12px 16px;
        }

        .secondaryButton:disabled {
          opacity: 0.38;
          cursor: default;
        }

        .workspace {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 380px;
          gap: 24px;
          min-height: calc(100vh - 180px);
        }

        .previewColumn {
          min-height: 0;
        }

        .stage {
          position: relative;
          min-height: 100%;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0)),
            rgba(255, 255, 255, 0.02);
          overflow: hidden;
        }

        .stageBlack {
          background: #000;
        }

        .stageActive {
          border-color: rgba(255, 255, 255, 0.3);
        }

        .sourceMount {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
        }

        .sourceMount {
          opacity: 0;
          pointer-events: none;
        }

        .previewCanvas {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          height: 100%;
          display: block;
        }

        .previewCanvasInteractive {
          will-change: transform;
          user-select: none;
        }

        .previewCanvasHidden {
          position: absolute;
          left: 0;
          top: 0;
          transform: none;
          width: 0;
          height: 0;
          opacity: 0;
          pointer-events: none;
        }

        .emptyState,
        .dropOverlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 24px;
        }

        .dropOverlay {
          background: rgba(0, 0, 0, 0.58);
          backdrop-filter: blur(18px);
        }

        .emptyTitle {
          font-size: 18px;
          margin-bottom: 8px;
        }

        .emptyBody {
          font-size: 14px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.68);
          margin-bottom: 18px;
          max-width: 32ch;
        }

        .busyPill,
        .hintPill {
          position: absolute;
          left: 18px;
          bottom: 18px;
          padding: 8px 10px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.44);
          color: rgba(255, 255, 255, 0.72);
          font-size: 12px;
          letter-spacing: 0.04em;
        }

        .busyPill {
          top: 18px;
          bottom: auto;
        }

        .panel {
          display: grid;
          gap: 18px;
          align-content: start;
          max-height: calc(100vh - 180px);
          overflow: auto;
          padding-right: 4px;
        }

        .card {
          padding: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
        }

        .actionsCard {
          position: sticky;
          top: 0;
          z-index: 2;
          backdrop-filter: blur(12px);
        }

        .buttonRow {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .status {
          margin-top: 14px;
          font-size: 13px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.66);
        }

        .status.ok {
          color: rgba(255, 255, 255, 0.88);
        }

        .status.error {
          color: #ff8f8f;
        }

        .sectionHeader {
          margin-bottom: 14px;
        }

        .sectionEyebrow {
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.58);
        }

        .presetGrid,
        .choiceGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
          gap: 10px;
        }

        .presetButton,
        .choiceButton {
          min-height: 40px;
          padding: 10px 12px;
        }

        .presetButtonActive,
        .choiceButtonActive {
          border-color: rgba(255, 255, 255, 0.42);
          background: rgba(255, 255, 255, 0.12);
        }

        .metadata {
          display: grid;
          gap: 12px;
        }

        .metadata div {
          display: grid;
          gap: 4px;
        }

        dt {
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.44);
        }

        dd {
          margin: 0;
          font-size: 14px;
          line-height: 1.45;
          color: rgba(255, 255, 255, 0.84);
          word-break: break-word;
        }

        .metadataEmpty {
          font-size: 14px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.68);
        }

        .passCard {
          display: grid;
          gap: 16px;
        }

        .passHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .toggle {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.72);
        }

        .toggle input {
          appearance: none;
          width: 16px;
          height: 16px;
          border: 1px solid rgba(255, 255, 255, 0.72);
          background: #000;
          margin: 0;
        }

        .toggle input:checked {
          background: #fff;
          box-shadow: inset 0 0 0 3px #000;
        }

        .choiceField {
          display: grid;
          gap: 10px;
        }

        .choiceLabel {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.74);
        }

        @media (max-width: 1160px) {
          .workspace {
            grid-template-columns: 1fr;
          }

          .panel {
            max-height: none;
            overflow: visible;
          }
        }

        @media (max-width: 720px) {
          .shell {
            padding: 18px;
          }

          .topbar {
            flex-direction: column;
          }

          .workspace {
            min-height: auto;
          }

          .stage {
            min-height: 56vh;
          }
        }
      `}</style>
    </main>
  );
}
