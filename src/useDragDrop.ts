import * as React from "react";
import type {
  DragDropOperation,
  DragIdentifier,
  DragLocation,
  DragSnapshot,
  GetContainerPropsOptions,
  GetHandlePropsOptions,
  GetItemPropsOptions,
  DragStartDelayOptions,
  UseDragDropOptions,
  UseDragDropResult
} from "./types";
import {
  getAutoScrollDelta,
  getDistanceToRect,
  getInsertionIndex,
  getKeyboardMoveTarget,
  moveItem,
  resolveDragStartDelay,
  toItemKey
} from "./utils";

interface ActiveDrag<T> {
  item: T;
  itemId: string;
  pointerId: number | null;
  mode: "pointer" | "keyboard";
  focusTarget: "item" | "handle";
  origin: DragLocation;
  current: DragLocation;
  startPoint: {
    x: number;
    y: number;
  };
}

interface PendingPointerDrag<T> {
  containerId: string;
  itemId: string;
  item: T;
  index: number;
  focusTarget: "item" | "handle";
  pointerId: number;
  startPoint: {
    x: number;
    y: number;
  };
  latestPoint: {
    x: number;
    y: number;
  };
  timeoutId: number | null;
  tolerance: number;
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

const DEFAULT_AUTO_SCROLL = {
  enabled: true,
  threshold: 48,
  maxSpeed: 20,
  includeWindow: true
} as const;

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
    autoScroll = true,
    dragStartDelay,
    disabled = false
  } = options;

  const [snapshot, setSnapshot] = React.useState<DragSnapshot>(EMPTY_SNAPSHOT);
  const resolvedAutoScroll = React.useMemo(() => {
    if (autoScroll === false) {
      return {
        ...DEFAULT_AUTO_SCROLL,
        enabled: false
      };
    }

    if (autoScroll === true) {
      return DEFAULT_AUTO_SCROLL;
    }

    return {
      ...DEFAULT_AUTO_SCROLL,
      ...autoScroll,
      enabled: autoScroll.enabled ?? true
    };
  }, [autoScroll]);

  const containerRefs = React.useRef(new Map<string, HTMLElement>());
  const itemRefs = React.useRef(new Map<string, HTMLElement>());
  const handleRefs = React.useRef(new Map<string, HTMLElement>());
  const activeDragRef = React.useRef<ActiveDrag<T> | null>(null);
  const pendingPointerDragRef = React.useRef<PendingPointerDrag<T> | null>(null);
  const lastPointerPointRef = React.useRef<{ x: number; y: number } | null>(null);
  const scrollAncestorsRef = React.useRef<HTMLElement[]>([]);
  const scrollFrameRef = React.useRef<number | null>(null);
  const containersRef = React.useRef(containers);
  const liveContainersRef = React.useRef(containers);
  const getItemIdRef = React.useRef(getItemId);
  const onChangeRef = React.useRef(onChange);
  const onDragStartRef = React.useRef(onDragStart);
  const onDragEndRef = React.useRef(onDragEnd);
  const getContainerAxisRef = React.useRef(getContainerAxis);
  const previousUserSelectRef = React.useRef<string | null>(null);
  const previousCursorRef = React.useRef<string | null>(null);
  const focusRequestRef = React.useRef<{
    containerId: string;
    itemId: string;
    target: "item" | "handle";
  } | null>(null);

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

  const scheduleFocus = React.useCallback(
    (containerId: string, itemId: string, target: "item" | "handle") => {
      focusRequestRef.current = { containerId, itemId, target };

      if (typeof window === "undefined") {
        return;
      }

      window.requestAnimationFrame(() => {
        const request = focusRequestRef.current;

        if (
          !request ||
          request.containerId !== containerId ||
          request.itemId !== itemId ||
          request.target !== target
        ) {
          return;
        }

        const key = toItemKey(containerId, itemId);
        const node =
          target === "handle"
            ? handleRefs.current.get(key) ?? itemRefs.current.get(key)
            : itemRefs.current.get(key);
        node?.focus();
      });
    },
    []
  );

  const findDragSource = React.useCallback((containerId: string, itemId: string) => {
    const currentContainers = containersRef.current;
    const sourceContainer = currentContainers.find(
      (container) => container.id === containerId
    );
    const sourceIndex =
      sourceContainer?.items.findIndex(
        (item) => String(getItemIdRef.current(item)) === itemId
      ) ?? -1;

    if (!sourceContainer || sourceIndex === -1) {
      return null;
    }

    return {
      container: sourceContainer,
      index: sourceIndex,
      item: sourceContainer.items[sourceIndex]
    };
  }, []);

  const getScrollableAncestors = React.useCallback((node: HTMLElement | null) => {
    if (typeof window === "undefined") {
      return [];
    }

    const ancestors: HTMLElement[] = [];
    let current = node?.parentElement ?? null;

    while (current) {
      const styles = window.getComputedStyle(current);
      const canScrollY =
        /(auto|scroll|overlay)/.test(styles.overflowY) &&
        current.scrollHeight > current.clientHeight;
      const canScrollX =
        /(auto|scroll|overlay)/.test(styles.overflowX) &&
        current.scrollWidth > current.clientWidth;

      if (canScrollX || canScrollY) {
        ancestors.push(current);
      }

      current = current.parentElement;
    }

    return ancestors;
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
      focusTarget: "item" | "handle";
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
        focusTarget: params.focusTarget,
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

  const stopAutoScrollLoop = React.useCallback(() => {
    if (typeof window !== "undefined" && scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = null;
  }, []);

  function clearPendingPointerDrag(): void {
    const pending = pendingPointerDragRef.current;

    if (!pending) {
      return;
    }

    if (typeof window !== "undefined" && pending.timeoutId !== null) {
      window.clearTimeout(pending.timeoutId);
    }

    pendingPointerDragRef.current = null;
    lastPointerPointRef.current = null;
    scrollAncestorsRef.current = [];

    if (!activeDragRef.current) {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
    }
  }

  const endDrag = React.useCallback(
    (reason: "drop" | "cancel") => {
      const activeDrag = activeDragRef.current;

      if (!activeDrag) {
        return;
      }

      if (activeDrag.mode === "pointer") {
        stopAutoScrollLoop();
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
        scheduleFocus(
          activeDrag.current.containerId,
          activeDrag.itemId,
          activeDrag.focusTarget
        );
      }

      activeDragRef.current = null;
      lastPointerPointRef.current = null;
      scrollAncestorsRef.current = [];
      setSnapshot(EMPTY_SNAPSHOT);
    },
    [scheduleFocus, stopAutoScrollLoop]
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

  const startAutoScrollLoop = React.useCallback(() => {
    if (
      typeof window === "undefined" ||
      !resolvedAutoScroll.enabled ||
      scrollFrameRef.current !== null
    ) {
      return;
    }

    const tick = () => {
      scrollFrameRef.current = null;

      const activeDrag = activeDragRef.current;
      const point = lastPointerPointRef.current;

      if (!activeDrag || activeDrag.mode !== "pointer" || !point) {
        return;
      }

      let didScroll = false;

      for (const ancestor of scrollAncestorsRef.current) {
        const rect = ancestor.getBoundingClientRect();
        const deltaX = getAutoScrollDelta(point.x, rect.left, rect.right, {
          threshold: resolvedAutoScroll.threshold,
          maxSpeed: resolvedAutoScroll.maxSpeed
        });
        const deltaY = getAutoScrollDelta(point.y, rect.top, rect.bottom, {
          threshold: resolvedAutoScroll.threshold,
          maxSpeed: resolvedAutoScroll.maxSpeed
        });

        if (deltaX !== 0 || deltaY !== 0) {
          const previousLeft = ancestor.scrollLeft;
          const previousTop = ancestor.scrollTop;

          ancestor.scrollBy({
            left: deltaX,
            top: deltaY
          });

          if (
            ancestor.scrollLeft !== previousLeft ||
            ancestor.scrollTop !== previousTop
          ) {
            didScroll = true;
          }
        }
      }

      if (resolvedAutoScroll.includeWindow) {
        const deltaX = getAutoScrollDelta(point.x, 0, window.innerWidth, {
          threshold: resolvedAutoScroll.threshold,
          maxSpeed: resolvedAutoScroll.maxSpeed
        });
        const deltaY = getAutoScrollDelta(point.y, 0, window.innerHeight, {
          threshold: resolvedAutoScroll.threshold,
          maxSpeed: resolvedAutoScroll.maxSpeed
        });

        if (deltaX !== 0 || deltaY !== 0) {
          const previousX = window.scrollX;
          const previousY = window.scrollY;

          window.scrollBy({
            left: deltaX,
            top: deltaY
          });

          if (window.scrollX !== previousX || window.scrollY !== previousY) {
            didScroll = true;
          }
        }
      }

      if (didScroll) {
        updatePosition(point.x, point.y);
        scrollFrameRef.current = window.requestAnimationFrame(tick);
      }
    };

    scrollFrameRef.current = window.requestAnimationFrame(tick);
  }, [resolvedAutoScroll, updatePosition]);

  function activatePendingPointerDrag(): void {
    const pending = pendingPointerDragRef.current;

    if (!pending) {
      return;
    }

    if (typeof window !== "undefined" && pending.timeoutId !== null) {
      window.clearTimeout(pending.timeoutId);
    }

    pendingPointerDragRef.current = null;
    previousUserSelectRef.current = document.body.style.userSelect;
    previousCursorRef.current = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    lastPointerPointRef.current = pending.latestPoint;

    startDrag({
      containerId: pending.containerId,
      itemId: pending.itemId,
      item: pending.item,
      index: pending.index,
      mode: "pointer",
      focusTarget: pending.focusTarget,
      pointerId: pending.pointerId,
      startPoint: pending.startPoint
    });

    startAutoScrollLoop();

    if (
      pending.latestPoint.x !== pending.startPoint.x ||
      pending.latestPoint.y !== pending.startPoint.y
    ) {
      updatePosition(pending.latestPoint.x, pending.latestPoint.y);
    }
  }

  const handlePointerMove = React.useCallback(
    (event: PointerEvent) => {
      const pending = pendingPointerDragRef.current;

      if (pending && event.pointerId === pending.pointerId && !activeDragRef.current) {
        pending.latestPoint = {
          x: event.clientX,
          y: event.clientY
        };
        lastPointerPointRef.current = pending.latestPoint;

        if (
          Math.hypot(
            event.clientX - pending.startPoint.x,
            event.clientY - pending.startPoint.y
          ) > pending.tolerance
        ) {
          clearPendingPointerDrag();
        }

        return;
      }

      const activeDrag = activeDragRef.current;

      if (
        !activeDrag ||
        activeDrag.mode !== "pointer" ||
        event.pointerId !== activeDrag.pointerId
      ) {
        return;
      }

      lastPointerPointRef.current = {
        x: event.clientX,
        y: event.clientY
      };
      startAutoScrollLoop();
      updatePosition(event.clientX, event.clientY);
    },
    [startAutoScrollLoop, updatePosition]
  );

  const handlePointerUp = React.useCallback(
    (event: PointerEvent) => {
      const pending = pendingPointerDragRef.current;

      if (pending && event.pointerId === pending.pointerId) {
        clearPendingPointerDrag();
        return;
      }

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
      const pending = pendingPointerDragRef.current;

      if (pending && event.pointerId === pending.pointerId) {
        clearPendingPointerDrag();
        return;
      }

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
    if (pendingPointerDragRef.current) {
      clearPendingPointerDrag();
      return;
    }

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
      const handleOnly = options?.handleOnly ?? false;
      const isActive =
        snapshot.activeItemId === normalizedItemId &&
        snapshot.activeContainerId === containerId;
      const style: React.CSSProperties = {
        touchAction: "none",
        cursor: isDisabled
          ? "not-allowed"
          : handleOnly
            ? options?.style?.cursor
            : isActive
              ? "grabbing"
              : "grab",
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
      const pointerHandler = handleOnly
        ? undefined
        : (event: React.PointerEvent<HTMLElement>) => {
            if (isDisabled || event.button !== 0 || activeDragRef.current) {
              return;
            }

            const source = findDragSource(containerId, normalizedItemId);

            if (!source) {
              return;
            }

            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // Some browsers throw here when pointer capture is unsupported.
            }

            const delayConfig = resolveDragStartDelay(
              event.pointerType,
              dragStartDelay
            );
            const startPoint = {
              x: event.clientX,
              y: event.clientY
            };
            lastPointerPointRef.current = startPoint;
            scrollAncestorsRef.current = getScrollableAncestors(
              itemRefs.current.get(toItemKey(containerId, normalizedItemId)) ?? null
            );
            document.addEventListener("pointermove", handlePointerMove);
            document.addEventListener("pointerup", handlePointerUp);
            document.addEventListener("pointercancel", handlePointerCancel);

            if (delayConfig.delay > 0) {
              pendingPointerDragRef.current = {
                containerId,
                itemId: normalizedItemId,
                item: source.item,
                index: source.index,
                focusTarget: "item",
                pointerId: event.pointerId,
                startPoint,
                latestPoint: startPoint,
                timeoutId: window.setTimeout(
                  activatePendingPointerDrag,
                  delayConfig.delay
                ),
                tolerance: delayConfig.tolerance
              };
              return;
            }

            previousUserSelectRef.current = document.body.style.userSelect;
            previousCursorRef.current = document.body.style.cursor;
            document.body.style.userSelect = "none";
            document.body.style.cursor = "grabbing";

            startDrag({
              containerId,
              itemId: normalizedItemId,
              item: source.item,
              index: source.index,
              mode: "pointer",
              focusTarget: "item",
              pointerId: event.pointerId,
              startPoint
            });

            startAutoScrollLoop();
          };
      const keyHandler = handleOnly
        ? undefined
        : (event: React.KeyboardEvent<HTMLElement>) => {
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

              const source = findDragSource(containerId, normalizedItemId);

              if (!source) {
                return;
              }

              startDrag({
                containerId,
                itemId: normalizedItemId,
                item: source.item,
                index: source.index,
                mode: "keyboard",
                focusTarget: "item",
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
            scheduleFocus(target.containerId, normalizedItemId, activeDrag.focusTarget);
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
        onPointerDown: pointerHandler,
        onKeyDown: keyHandler,
        "data-drag-item-id": normalizedItemId,
        "data-drag-container-id": containerId,
        "data-drag-handle-only": handleOnly || undefined,
        role: handleOnly ? undefined : ("button" as const),
        tabIndex: handleOnly ? undefined : 0,
        "aria-grabbed": handleOnly ? undefined : isActive,
        style
      };
    },
    [
      applyMove,
      disabled,
      dragStartDelay,
      endDrag,
      handlePointerCancel,
      handlePointerMove,
      handlePointerUp,
      findDragSource,
      getScrollableAncestors,
      scheduleFocus,
      snapshot,
      startAutoScrollLoop,
      startDrag
    ]
  );

  const isPlaceholder = React.useCallback(
    (containerId: string, index: number) =>
      snapshot.isDragging &&
      snapshot.overContainerId === containerId &&
      snapshot.overIndex === index,
    [snapshot]
  );

  const getPlaceholderProps = React.useCallback(
    (
      containerId: string,
      index: number,
      options?: {
        style?: React.CSSProperties;
        activeStyle?: React.CSSProperties;
        inactiveStyle?: React.CSSProperties;
      }
    ) => {
      const active = isPlaceholder(containerId, index);
      const defaultStyle: React.CSSProperties = {
        height: active ? 6 : 0,
        borderRadius: 999,
        background: active ? "#0ea5e9" : "transparent",
        opacity: active ? 1 : 0,
        transform: active ? "scaleX(1)" : "scaleX(0.4)",
        transformOrigin: "center",
        transition:
          "height 140ms ease, opacity 140ms ease, transform 140ms ease, background 140ms ease"
      };

      return {
        "data-drag-placeholder": "true" as const,
        "data-drag-placeholder-active": active,
        "aria-hidden": true as const,
        style: {
          ...defaultStyle,
          ...options?.style,
          ...(active ? options?.activeStyle : options?.inactiveStyle)
        }
      };
    },
    [isPlaceholder]
  );

  const getHandleProps = React.useCallback(
    (
      containerId: string,
      itemId: DragIdentifier,
      options?: GetHandlePropsOptions
    ) => {
      const normalizedItemId = String(itemId);
      const isDisabled = disabled || options?.disabled;
      const isActive =
        snapshot.activeItemId === normalizedItemId &&
        snapshot.activeContainerId === containerId;

      return {
        ref: (node: HTMLElement | null) => {
          const key = toItemKey(containerId, normalizedItemId);

          if (node) {
            handleRefs.current.set(key, node);
            return;
          }

          handleRefs.current.delete(key);
        },
        onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
          if (isDisabled || event.button !== 0 || activeDragRef.current) {
            return;
          }

          const source = findDragSource(containerId, normalizedItemId);

          if (!source) {
            return;
          }

          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Some browsers throw here when pointer capture is unsupported.
          }

          const delayConfig = resolveDragStartDelay(
            event.pointerType,
            dragStartDelay
          );
          const startPoint = {
            x: event.clientX,
            y: event.clientY
          };
          lastPointerPointRef.current = startPoint;
          scrollAncestorsRef.current = getScrollableAncestors(
            itemRefs.current.get(toItemKey(containerId, normalizedItemId)) ?? null
          );
          document.addEventListener("pointermove", handlePointerMove);
          document.addEventListener("pointerup", handlePointerUp);
          document.addEventListener("pointercancel", handlePointerCancel);

          if (delayConfig.delay > 0) {
            pendingPointerDragRef.current = {
              containerId,
              itemId: normalizedItemId,
              item: source.item,
              index: source.index,
              focusTarget: "handle",
              pointerId: event.pointerId,
              startPoint,
              latestPoint: startPoint,
              timeoutId: window.setTimeout(
                activatePendingPointerDrag,
                delayConfig.delay
              ),
              tolerance: delayConfig.tolerance
            };
            return;
          }

          previousUserSelectRef.current = document.body.style.userSelect;
          previousCursorRef.current = document.body.style.cursor;
          document.body.style.userSelect = "none";
          document.body.style.cursor = "grabbing";

          startDrag({
            containerId,
            itemId: normalizedItemId,
            item: source.item,
            index: source.index,
            mode: "pointer",
            focusTarget: "handle",
            pointerId: event.pointerId,
            startPoint
          });

          startAutoScrollLoop();
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

            const source = findDragSource(containerId, normalizedItemId);

            if (!source) {
              return;
            }

            startDrag({
              containerId,
              itemId: normalizedItemId,
              item: source.item,
              index: source.index,
              mode: "keyboard",
              focusTarget: "handle",
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
          scheduleFocus(target.containerId, normalizedItemId, activeDrag.focusTarget);
        },
        "data-drag-handle": "true" as const,
        "data-drag-item-id": normalizedItemId,
        "data-drag-container-id": containerId,
        role: "button" as const,
        tabIndex: 0,
        "aria-grabbed": isActive,
        "aria-label": options?.ariaLabel,
        style: {
          touchAction: "none",
          cursor: isDisabled ? "not-allowed" : isActive ? "grabbing" : "grab",
          ...options?.style
        }
      };
    },
    [
      applyMove,
      disabled,
      dragStartDelay,
      endDrag,
      findDragSource,
      getScrollableAncestors,
      handlePointerCancel,
      handlePointerMove,
      handlePointerUp,
      scheduleFocus,
      snapshot,
      startAutoScrollLoop,
      startDrag
    ]
  );

  return {
    getContainerProps,
    getItemProps,
    getPlaceholderProps,
    getHandleProps,
    isPlaceholder,
    snapshot,
    cancelDrag
  };
}
