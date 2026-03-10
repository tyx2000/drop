import type {
  DragAxis,
  DragContainer,
  DragLocation,
  DragStartDelayOptions
} from "./types";

export type KeyboardMoveKey =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight";

export interface RectLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export interface AutoScrollConfig {
  threshold: number;
  maxSpeed: number;
}

export interface ResolvedDragStartDelay {
  delay: number;
  tolerance: number;
}

export function toItemKey(containerId: string, itemId: string): string {
  return `${containerId}::${itemId}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function cloneContainers<T>(
  containers: readonly DragContainer<T>[]
): DragContainer<T>[] {
  return containers.map((container) => ({
    ...container,
    items: [...container.items]
  }));
}

export function getDistanceToRect(x: number, y: number, rect: RectLike): number {
  const dx =
    x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
  const dy =
    y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;

  return dx * dx + dy * dy;
}

export function moveItem<T>(
  containers: readonly DragContainer<T>[],
  from: DragLocation,
  to: DragLocation
): { containers: DragContainer<T>[]; item: T; to: DragLocation } | null {
  if (from.containerId === to.containerId && from.index === to.index) {
    return null;
  }

  const nextContainers = cloneContainers(containers);
  const source = nextContainers.find((container) => container.id === from.containerId);
  const target = nextContainers.find((container) => container.id === to.containerId);

  if (!source || !target) {
    return null;
  }

  const [item] = source.items.splice(from.index, 1);

  if (typeof item === "undefined") {
    return null;
  }

  const nextIndex = clamp(to.index, 0, target.items.length);
  target.items.splice(nextIndex, 0, item);

  return {
    containers: nextContainers,
    item,
    to: {
      containerId: target.id,
      index: nextIndex
    }
  };
}

export function getInsertionIndex(
  axis: DragAxis,
  pointer: { x: number; y: number },
  itemRects: readonly RectLike[]
): number {
  const index = itemRects.findIndex((rect) =>
    axis === "horizontal"
      ? pointer.x < rect.left + rect.width / 2
      : pointer.y < rect.top + rect.height / 2
  );

  return index === -1 ? itemRects.length : index;
}

export function getKeyboardMoveTarget<T>(
  containers: readonly DragContainer<T>[],
  current: DragLocation,
  key: KeyboardMoveKey,
  getContainerAxis?: (containerId: string) => DragAxis
): DragLocation | null {
  const containerIndex = containers.findIndex(
    (container) => container.id === current.containerId
  );

  if (containerIndex === -1) {
    return null;
  }

  const currentContainer = containers[containerIndex];

  if (!currentContainer) {
    return null;
  }

  const axis = getContainerAxis?.(current.containerId) ?? "vertical";
  const localPreviousKey = axis === "vertical" ? "ArrowUp" : "ArrowLeft";
  const localNextKey = axis === "vertical" ? "ArrowDown" : "ArrowRight";
  const crossPreviousKey = axis === "vertical" ? "ArrowLeft" : "ArrowUp";
  const crossNextKey = axis === "vertical" ? "ArrowRight" : "ArrowDown";

  if (key === localPreviousKey) {
    if (current.index <= 0) {
      return null;
    }

    return {
      containerId: current.containerId,
      index: current.index - 1
    };
  }

  if (key === localNextKey) {
    if (current.index >= currentContainer.items.length - 1) {
      return null;
    }

    return {
      containerId: current.containerId,
      index: current.index + 1
    };
  }

  if (key === crossPreviousKey || key === crossNextKey) {
    const nextContainerIndex =
      key === crossPreviousKey ? containerIndex - 1 : containerIndex + 1;
    const nextContainer = containers[nextContainerIndex];

    if (!nextContainer) {
      return null;
    }

    return {
      containerId: nextContainer.id,
      index: clamp(current.index, 0, nextContainer.items.length)
    };
  }

  return null;
}

export function getAutoScrollDelta(
  pointer: number,
  start: number,
  end: number,
  config: AutoScrollConfig
): number {
  const { threshold, maxSpeed } = config;

  if (pointer < start + threshold) {
    const ratio = (start + threshold - pointer) / threshold;
    return -Math.min(maxSpeed, Math.ceil(ratio * maxSpeed));
  }

  if (pointer > end - threshold) {
    const ratio = (pointer - (end - threshold)) / threshold;
    return Math.min(maxSpeed, Math.ceil(ratio * maxSpeed));
  }

  return 0;
}

export function resolveDragStartDelay(
  pointerType: string,
  config?: number | DragStartDelayOptions
): ResolvedDragStartDelay {
  if (typeof config === "number") {
    return {
      delay: Math.max(0, config),
      tolerance: 8
    };
  }

  return {
    delay: Math.max(
      0,
      pointerType === "touch"
        ? config?.touch ?? 0
        : pointerType === "pen"
          ? config?.pen ?? 0
          : config?.mouse ?? 0
    ),
    tolerance: Math.max(0, config?.tolerance ?? 8)
  };
}
