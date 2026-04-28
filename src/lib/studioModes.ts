import type { StudioFxPresetId } from "@/lib/studioFx";

export type StudioMode = "image" | "boids" | "cymatics";

export type BoidsStudioSettings = {
  densityIndex: number;
  flocking: number;
  separation: number;
  size: number;
  speed: number;
};

export type CymaticsStudioSettings = {
  baseBlue: number;
  baseGreen: number;
  baseRed: number;
  harmonicM: number;
  harmonicN: number;
  hueShift: number;
  nodePull: number;
  particleDensity: number;
  particleSize: number;
};

export const BOIDS_STUDIO_DENSITY_COUNTS = [
  2000,
  1200,
  600,
] as const;

export const STUDIO_MODE_LABELS: Record<StudioMode, string> = {
  image: "Image",
  boids: "Creature",
  cymatics: "Cymatics",
};

export const STUDIO_MODE_DEFAULT_PRESETS: Record<
  StudioMode,
  StudioFxPresetId
> = {
  image: "boids",
  boids: "boids",
  cymatics: "cymatics",
};

export const createDefaultBoidsStudioSettings = (): BoidsStudioSettings => ({
  densityIndex: 0,
  flocking: 1,
  separation: 1,
  size: 5,
  speed: 1,
});

export const createDefaultCymaticsStudioSettings =
  (): CymaticsStudioSettings => ({
    baseBlue: 255,
    baseGreen: 21,
    baseRed: 0,
    harmonicM: 2,
    harmonicN: 5,
    hueShift: 0.17,
    nodePull: 1,
    particleDensity: 2.3,
    particleSize: 1,
  });
