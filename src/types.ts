import type * as React from "react";

export type DragAxis = "vertical" | "horizontal";
export type DragIdentifier = string | number;

export interface AutoScrollOptions {
  enabled?: boolean;
  threshold?: number;
  maxSpeed?: number;
  includeWindow?: boolean;
}

export interface DragStartDelayOptions {
  mouse?: number;
  touch?: number;
  pen?: number;
  tolerance?: number;
}

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
  autoScroll?: boolean | AutoScrollOptions;
  dragStartDelay?: number | DragStartDelayOptions;
  disabled?: boolean;
}

export interface GetContainerPropsOptions {
  style?: React.CSSProperties;
}

export interface GetItemPropsOptions {
  disabled?: boolean;
  handleOnly?: boolean;
  style?: React.CSSProperties;
}

export interface GetPlaceholderPropsOptions {
  style?: React.CSSProperties;
  activeStyle?: React.CSSProperties;
  inactiveStyle?: React.CSSProperties;
}

export interface GetHandlePropsOptions {
  disabled?: boolean;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

export interface DragContainerProps {
  ref: (node: HTMLElement | null) => void;
  "data-drag-container-id": string;
  style?: React.CSSProperties;
}

export interface DragItemProps {
  ref: (node: HTMLElement | null) => void;
  onPointerDown?: React.PointerEventHandler<HTMLElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  "data-drag-item-id": string;
  "data-drag-container-id": string;
  role?: "button";
  tabIndex?: number;
  "aria-grabbed"?: boolean;
  "data-drag-handle-only"?: boolean;
  style?: React.CSSProperties;
}

export interface DragPlaceholderProps {
  "data-drag-placeholder": "true";
  "data-drag-placeholder-active": boolean;
  "aria-hidden": true;
  style?: React.CSSProperties;
}

export interface DragHandleProps {
  ref: (node: HTMLElement | null) => void;
  onPointerDown: React.PointerEventHandler<HTMLElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLElement>;
  "data-drag-handle": "true";
  "data-drag-item-id": string;
  "data-drag-container-id": string;
  role: "button";
  tabIndex: number;
  "aria-grabbed": boolean;
  "aria-label"?: string;
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
  getPlaceholderProps: (
    containerId: string,
    index: number,
    options?: GetPlaceholderPropsOptions
  ) => DragPlaceholderProps;
  getHandleProps: (
    containerId: string,
    itemId: DragIdentifier,
    options?: GetHandlePropsOptions
  ) => DragHandleProps;
  isPlaceholder: (containerId: string, index: number) => boolean;
  snapshot: DragSnapshot;
  cancelDrag: () => void;
}
