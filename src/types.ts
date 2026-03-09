import type * as React from "react";

export type DragAxis = "vertical" | "horizontal";
export type DragIdentifier = string | number;

export interface DragContainer<T> {
  id: string;
  items: T[];
}

export interface DragLocation {
  containerId: string;
  index: number;
}

export interface DragDropOperation<T> {
  item: T;
  itemId: string;
  from: DragLocation;
  to: DragLocation;
}

export interface DragSnapshot {
  activeItemId: string | null;
  activeContainerId: string | null;
  overContainerId: string | null;
  overIndex: number | null;
  isDragging: boolean;
  mode: "pointer" | "keyboard" | null;
  translate: {
    x: number;
    y: number;
  };
}

export interface UseDragDropOptions<T> {
  containers: readonly DragContainer<T>[];
  getItemId: (item: T) => DragIdentifier;
  onChange: (
    nextContainers: DragContainer<T>[],
    operation: DragDropOperation<T>
  ) => void;
  onDragStart?: (operation: DragDropOperation<T>) => void;
  onDragEnd?: (operation: DragDropOperation<T>) => void;
  getContainerAxis?: (containerId: string) => DragAxis;
  disabled?: boolean;
}

export interface GetContainerPropsOptions {
  style?: React.CSSProperties;
}

export interface GetItemPropsOptions {
  disabled?: boolean;
  style?: React.CSSProperties;
}

export interface DragContainerProps {
  ref: (node: HTMLElement | null) => void;
  "data-drag-container-id": string;
  style?: React.CSSProperties;
}

export interface DragItemProps {
  ref: (node: HTMLElement | null) => void;
  onPointerDown: React.PointerEventHandler<HTMLElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLElement>;
  "data-drag-item-id": string;
  "data-drag-container-id": string;
  role: "button";
  tabIndex: number;
  "aria-grabbed": boolean;
  style?: React.CSSProperties;
}

export interface UseDragDropResult {
  getContainerProps: (
    containerId: string,
    options?: GetContainerPropsOptions
  ) => DragContainerProps;
  getItemProps: (
    containerId: string,
    itemId: DragIdentifier,
    options?: GetItemPropsOptions
  ) => DragItemProps;
  snapshot: DragSnapshot;
  cancelDrag: () => void;
}
