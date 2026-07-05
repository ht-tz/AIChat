import { describe, it, expect } from "vitest";
import { getModelById, getAllModels, MODEL_OPTIONS } from "@/stores/settings";

describe("settings", () => {
  it("getModelById returns mock model", () => {
    const model = getModelById("mock-default");
    expect(model).toBeDefined();
    expect(model?.provider).toBe("mock");
  });

  it("getModelById returns undefined for unknown id", () => {
    expect(getModelById("nonexistent")).toBeUndefined();
  });

  it("getModelById checks custom models", () => {
    const custom = { id: "custom-1", label: "Custom", provider: "openai" as const, custom: true };
    expect(getModelById("custom-1", [custom])).toBeDefined();
  });

  it("getAllModels returns all built-in models", () => {
    const models = getAllModels();
    expect(models.length).toBe(MODEL_OPTIONS.length);
  });

  it("getAllModels includes custom models", () => {
    const custom = { id: "c1", label: "C", provider: "openai" as const };
    const models = getAllModels([custom]);
    expect(models.length).toBe(MODEL_OPTIONS.length + 1);
  });
});
