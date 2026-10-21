"use client";

/**
 * 兼容层：bench-scene 仍从 `./vessel-art` 引用。
 * 真实绘制已拆到 `./vessels/`（玻璃三层质感 / 现象层 / 几何 / 气泡计划），
 * 本文件只保留导出，避免改动调用方与既有 data-demo-id。
 */

export { VesselArt, type VesselArtProps } from "./vessels";
