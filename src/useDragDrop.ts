import * as React from "react";
import type {
  DragDropOperation,
  DragIdentifier,
  DragLocation,
  DragSnapshot,
  GetContainerPropsOptions,
  GetItemPropsOptions,
  UseDragDropOptions,
  UseDragDropResult
} from "./types";
import {
  getDistanceToRect,
  getInsertionIndex,
  getKeyboardMoveTarget,
  moveItem,
  toItemKey
} from "./utils";

interface ActiveDrag<T> {
  item: T;
  itemId: string;
  pointerId: number | null;
  mode: "pointer" | "keyboard";
  origin: DragLocation;
  current: DragLocation;
  startPoint: {
    x: number;
    y: number;
  };
}

const EMPTY_SNAPSHOT: DragSnapshot = {
  activeItemId: null,
  activeContainerId: null,
  overContainerId: null,
  overIndex: null,
  isDragging: false,
  mode: null,
  translate: {
    x: 0,
    y: 0
  }
};

export function useDragDrop<T>(
  options: UseDragDropOptions<T>
): UseDragDropResult {
  const {
    containers,
    getItemId,
    onChange,
    onDragStart,
    onDragEnd,
    getContainerAxis,
    disabled = false
  } = options;

  const [snapshot, setSnapshot] = React.useState<DragSnapshot>(EMPTY_SNAPSHOT);

  const containerRefs = React.useRef(new Map<string, HTMLElement>());
  const itemRefs = React.useRef(new Map<string, HTMLElement>());
  const activeDragRef = React.useRef<ActiveDrag<T> | null>(null);
  const containersRef = React.useRef(containers);
  const liveContainersRef = React.useRef(containers);
  const getItemIdRef = React.useRef(getItemId);
  const onChangeRef = React.useRef(onChange);
  const onDragStartRef = React.useRef(onDragStart);
  const onDragEndRef = React.useRef(onDragEnd);
  const getContainerAxisRef = React.useRef(getContainerAxis);
  const previousUserSelectRef = React.useRef<string | null>(null);
  const previousCursorRef = React.useRef<string | null>(null);
  const focusRequestRef = React.useRef<{ containerId: string; itemId: string } | null>(
    null
  );

  React.useEffect(() => {
    containersRef.current = containers;
    liveContainersRef.current = containers;
  }, [containers]);

  React.useEffect(() => {
    getItemIdRef.current = getItemId;
    onChangeRef.current = onChange;
    onDragStartRef.current = onDragStart;
    onDragEndRef.current = onDragEnd;
    getContainerAxisRef.current = getContainerAxis;
  }, [getItemId, onChange, onDragStart, onDragEnd, getContainerAxis]);

  const scheduleFocus = React.useCallback((containerId: string, itemId: string) => {
    focusRequestRef.current = { containerId, itemId };

    if (typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      const request = focusRequestRef.current;

      if (
        !request ||
        request.containerId !== containerId ||
        request.itemId !== itemId
      ) {
        return;
      }

      const node = itemRefs.current.get(toItemKey(containerId, itemId));
      node?.focus();
    });
  }, []);

  const applyMove = React.useCallback((target: DragLocation) => {
    const activeDrag = activeDragRef.current;

    if (!activeDrag) {
      return;
    }

    const moveResult = moveItem(liveContainersRef.current, activeDrag.current, target);

    if (!moveResult) {
      setSnapshot((currentSnapshot) => ({
        ...currentSnapshot,
        overContainerId: target.containerId,
        overIndex: target.index
      }));
      return;
    }

    liveContainersRef.current = moveResult.containers;
    activeDragRef.current = {
      ...activeDrag,
      current: moveResult.to
    };

    onChangeRef.current(moveResult.containers, {
      item: moveResult.item,
      itemId: activeDrag.itemId,
      from: activeDrag.origin,
      to: moveResult.to
    });

    setSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      activeContainerId: moveResult.to.containerId,
      overContainerId: moveResult.to.containerId,
      overIndex: moveResult.to.index
    }));
  }, []);

  const startDrag = React.useCallback(
    (params: {
      containerId: string;
      itemId: string;
      item: T;
      index: number;
      mode: "pointer" | "keyboard";
      pointerId: number | null;
      startPoint?: {
        x: number;
        y: number;
      };
    }) => {
      const operation: DragDropOperation<T> = {
        item: params.item,
        itemId: params.itemId,
        from: {
          containerId: params.containerId,
          index: params.index
        },
        to: {
          containerId: params.containerId,
          index: params.index
        }
      };

      activeDragRef.current = {
        item: params.item,
        itemId: params.itemId,
        pointerId: params.pointerId,
        mode: params.mode,
        origin: operation.from,
        current: operation.to,
        startPoint: params.startPoint ?? {
          x: 0,
          y: 0
        }
      };
      liveContainersRef.current = containersRef.current;

      setSnapshot({
        activeItemId: params.itemId,
        activeContainerId: params.containerId,
        overContainerId: params.containerId,
        overIndex: params.index,
        isDragging: true,
        mode: params.mode,
        translate: {
          x: 0,
          y: 0
        }
      });

      onDragStartRef.current?.(operation);
    },
    []
  );

  const endDrag = React.useCallback(
    (reason: "drop" | "cancel") => {
      const activeDrag = activeDragRef.current;

      if (!activeDrag) {
        return;
      }

      if (activeDrag.mode === "pointer") {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        document.removeEventListener("pointercancel", handlePointerCancel);

        if (previousUserSelectRef.current !== null) {
          document.body.style.userSelect = previousUserSelectRef.current;
        }

        if (previousCursorRef.current !== null) {
          document.body.style.cursor = previousCursorRef.current;
        }
      }

      if (reason === "drop") {
        onDragEndRef.current?.({
          item: activeDrag.item,
          itemId: activeDrag.itemId,
          from: activeDrag.origin,
          to: activeDrag.current
        });
      }

      if (activeDrag.mode === "keyboard") {
        scheduleFocus(activeDrag.current.containerId, activeDrag.itemId);
      }

      activeDragRef.current = null;
      setSnapshot(EMPTY_SNAPSHOT);
    },
    [scheduleFocus]
  );

  const resolveTarget = React.useCallback((x: number, y: number): DragLocation | null => {
    const activeDrag = activeDragRef.current;
    const activeContainers = liveContainersRef.current;

    if (!activeDrag) {
      return null;
    }

    let matchedContainerId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const [containerId, element] of containerRefs.current.entries()) {
      const rect = element.getBoundingClientRect();
      const withinBounds =
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom;

      if (withinBounds) {
        matchedContainerId = containerId;
        break;
      }

      const distance = getDistanceToRect(x, y, rect);
      if (distance < nearestDistance) {
        matchedContainerId = containerId;
        nearestDistance = distance;
      }
    }

    if (!matchedContainerId) {
      return null;
    }

    const container = activeContainers.find(
      (entry) => entry.id === matchedContainerId
    );

    if (!container) {
      return null;
    }

    const axis = getContainerAxisRef.current?.(matchedContainerId) ?? "vertical";
    const orderedItems = container.items
      .map((item) => ({
        id: String(getItemIdRef.current(item)),
        element: itemRefs.current.get(
          toItemKey(matchedContainerId, String(getItemIdRef.current(item)))
        )
      }))
      .filter(
        (entry) =>
          entry.id !== activeDrag.itemId && typeof entry.element !== "undefined"
      );

    if (orderedItems.length === 0) {
      return {
        containerId: matchedContainerId,
        index: 0
      };
    }

    return {
      containerId: matchedContainerId,
      index: getInsertionIndex(
        axis,
        { x, y },
        orderedItems
          .map(({ element }) => element?.getBoundingClientRect())
          .filter((rect): rect is DOMRect => typeof rect !== "undefined")
      )
    };
  }, []);

  const updatePosition = React.useCallback(
    (clientX: number, clientY: number) => {
      const activeDrag = activeDragRef.current;

      if (!activeDrag) {
        return;
      }

      setSnapshot((currentSnapshot) => ({
        ...currentSnapshot,
        translate: {
          x: clientX - activeDrag.startPoint.x,
          y: clientY - activeDrag.startPoint.y
        }
      }));

      const target = resolveTarget(clientX, clientY);

      if (!target) {
        return;
      }

      applyMove(target);
    },
    [applyMove, resolveTarget]
  );

  const handlePointerMove = React.useCallback(
    (event: PointerEvent) => {
      const activeDrag = activeDragRef.current;

      if (
        !activeDrag ||
        activeDrag.mode !== "pointer" ||
        event.pointerId !== activeDrag.pointerId
      ) {
        return;
      }

      updatePosition(event.clientX, event.clientY);
    },
    [updatePosition]
  );

  const handlePointerUp = React.useCallback(
    (event: PointerEvent) => {
      const activeDrag = activeDragRef.current;

      if (
        !activeDrag ||
        activeDrag.mode !== "pointer" ||
        event.pointerId !== activeDrag.pointerId
      ) {
        return;
      }

      endDrag("drop");
    },
    [endDrag]
  );

  const handlePointerCancel = React.useCallback(
    (event: PointerEvent) => {
      const activeDrag = activeDragRef.current;

      if (
        !activeDrag ||
        activeDrag.mode !== "pointer" ||
        event.pointerId !== activeDrag.pointerId
      ) {
        return;
      }

      endDrag("cancel");
    },
    [endDrag]
  );

  const cancelDrag = React.useCallback(() => {
    endDrag("cancel");
  }, [endDrag]);

  React.useEffect(() => cancelDrag, [cancelDrag]);

  const getContainerProps = React.useCallback(
    (containerId: string, options?: GetContainerPropsOptions) => ({
      ref: (node: HTMLElement | null) => {
        if (node) {
          containerRefs.current.set(containerId, node);
          return;
        }

        containerRefs.current.delete(containerId);
      },
      "data-drag-container-id": containerId,
      style: options?.style
    }),
    []
  );

  const getItemProps = React.useCallback(
    (containerId: string, itemId: DragIdentifier, options?: GetItemPropsOptions) => {
      const normalizedItemId = String(itemId);
      const isDisabled = disabled || options?.disabled;
      const isActive =
        snapshot.activeItemId === normalizedItemId &&
        snapshot.activeContainerId === containerId;
      const style: React.CSSProperties = {
        touchAction: "none",
        cursor: isDisabled ? "not-allowed" : isActive ? "grabbing" : "grab",
        opacity: isActive ? 0.9 : 1,
        transform: isActive
          ? `translate3d(${snapshot.translate.x}px, ${snapshot.translate.y}px, 0)`
          : undefined,
        zIndex: isActive ? 10 : undefined,
        position: isActive ? "relative" : undefined,
        boxShadow: isActive
          ? "0 12px 28px rgba(15, 23, 42, 0.15)"
          : undefined,
        ...options?.style
      };

      return {
        ref: (node: HTMLElement | null) => {
          const key = toItemKey(containerId, normalizedItemId);

          if (node) {
            itemRefs.current.set(key, node);
            return;
          }

          itemRefs.current.delete(key);
        },
        onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
          if (isDisabled || event.button !== 0 || activeDragRef.current) {
            return;
          }

          const currentContainers = containersRef.current;
          const sourceContainer = currentContainers.find(
            (container) => container.id === containerId
          );
          const sourceIndex =
            sourceContainer?.items.findIndex(
              (item) => String(getItemIdRef.current(item)) === normalizedItemId
            ) ?? -1;

          if (!sourceContainer || sourceIndex === -1) {
            return;
          }

          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Some browsers throw here when pointer capture is unsupported.
          }

          previousUserSelectRef.current = document.body.style.userSelect;
          previousCursorRef.current = document.body.style.cursor;
          document.body.style.userSelect = "none";
          document.body.style.cursor = "grabbing";

          startDrag({
            containerId,
            itemId: normalizedItemId,
            item: sourceContainer.items[sourceIndex],
            index: sourceIndex,
            mode: "pointer",
            pointerId: event.pointerId,
            startPoint: {
              x: event.clientX,
              y: event.clientY
            }
          });

          document.addEventListener("pointermove", handlePointerMove);
          document.addEventListener("pointerup", handlePointerUp);
          document.addEventListener("pointercancel", handlePointerCancel);
        },
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
          if (isDisabled) {
            return;
          }

          const activeDrag = activeDragRef.current;
          const isSameActiveItem =
            activeDrag?.itemId === normalizedItemId &&
            activeDrag.current.containerId === containerId;

          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();

            if (activeDrag && activeDrag.mode === "keyboard" && isSameActiveItem) {
              endDrag("drop");
              return;
            }

            if (activeDrag) {
              return;
            }

            const currentContainers = containersRef.current;
            const sourceContainer = currentContainers.find(
              (container) => container.id === containerId
            );
            const sourceIndex =
              sourceContainer?.items.findIndex(
                (item) => String(getItemIdRef.current(item)) === normalizedItemId
              ) ?? -1;

            if (!sourceContainer || sourceIndex === -1) {
              return;
            }

            startDrag({
              containerId,
              itemId: normalizedItemId,
              item: sourceContainer.items[sourceIndex],
              index: sourceIndex,
              mode: "keyboard",
              pointerId: null
            });
            return;
          }

          if (event.key === "Escape") {
            if (activeDrag && activeDrag.mode === "keyboard" && isSameActiveItem) {
              event.preventDefault();
              endDrag("cancel");
            }
            return;
          }

          if (
            event.key !== "ArrowUp" &&
            event.key !== "ArrowDown" &&
            event.key !== "ArrowLeft" &&
            event.key !== "ArrowRight"
          ) {
            return;
          }

          if (!activeDrag || activeDrag.mode !== "keyboard" || !isSameActiveItem) {
            return;
          }

          const target = getKeyboardMoveTarget(
            liveContainersRef.current,
            activeDrag.current,
            event.key,
            getContainerAxisRef.current
          );

          if (!target) {
            return;
          }

          event.preventDefault();
          applyMove(target);
          scheduleFocus(target.containerId, normalizedItemId);
        },
        "data-drag-item-id": normalizedItemId,
        "data-drag-container-id": containerId,
        role: "button" as const,
        tabIndex: 0,
        "aria-grabbed": isActive,
        style
      };
    },
    [
      applyMove,
      disabled,
      endDrag,
      handlePointerCancel,
      handlePointerMove,
      handlePointerUp,
      scheduleFocus,
      snapshot,
      startDrag
    ]
  );

  return {
    getContainerProps,
    getItemProps,
    snapshot,
    cancelDrag
  };
}
