import { describe, expect, it } from "vitest";
import type { DragContainer } from "./types";
import {
  getAutoScrollDelta,
  getDistanceToRect,
  getInsertionIndex,
  getKeyboardMoveTarget,
  resolveDragStartDelay,
  moveItem
} from "./utils";

type Item = {
  id: string;
  label: string;
};

function createContainers(): DragContainer<Item>[] {
  return [
    {
      id: "todo",
      items: [
        { id: "1", label: "One" },
        { id: "2", label: "Two" },
        { id: "3", label: "Three" }
      ]
    },
    {
      id: "done",
      items: [{ id: "4", label: "Four" }]
    }
  ];
}

describe("moveItem", () => {
  it("reorders items within the same container", () => {
    const containers = createContainers();

    const result = moveItem(
      containers,
      { containerId: "todo", index: 0 },
      { containerId: "todo", index: 2 }
    );

    expect(result?.containers[0]?.items.map((item) => item.id)).toEqual([
      "2",
      "3",
      "1"
    ]);
    expect(containers[0]?.items.map((item) => item.id)).toEqual(["1", "2", "3"]);
  });

  it("moves items across containers", () => {
    const containers = createContainers();

    const result = moveItem(
      containers,
      { containerId: "todo", index: 1 },
      { containerId: "done", index: 1 }
    );

    expect(result?.containers[0]?.items.map((item) => item.id)).toEqual(["1", "3"]);
    expect(result?.containers[1]?.items.map((item) => item.id)).toEqual(["4", "2"]);
    expect(result?.to).toEqual({ containerId: "done", index: 1 });
  });

  it("supports dropping into an empty container", () => {
    const containers: DragContainer<Item>[] = [
      {
        id: "source",
        items: [{ id: "1", label: "One" }]
      },
      {
        id: "target",
        items: []
      }
    ];

    const result = moveItem(
      containers,
      { containerId: "source", index: 0 },
      { containerId: "target", index: 0 }
    );

    expect(result?.containers[0]?.items).toEqual([]);
    expect(result?.containers[1]?.items.map((item) => item.id)).toEqual(["1"]);
  });
});

describe("getInsertionIndex", () => {
  it("returns the correct vertical insertion slot", () => {
    const itemRects = [
      { left: 0, right: 100, top: 0, bottom: 20, width: 100, height: 20 },
      { left: 0, right: 100, top: 30, bottom: 50, width: 100, height: 20 },
      { left: 0, right: 100, top: 60, bottom: 80, width: 100, height: 20 }
    ];

    expect(getInsertionIndex("vertical", { x: 10, y: 5 }, itemRects)).toBe(0);
    expect(getInsertionIndex("vertical", { x: 10, y: 40 }, itemRects)).toBe(2);
    expect(getInsertionIndex("vertical", { x: 10, y: 90 }, itemRects)).toBe(3);
  });

  it("returns the correct horizontal insertion slot", () => {
    const itemRects = [
      { left: 0, right: 50, top: 0, bottom: 20, width: 50, height: 20 },
      { left: 60, right: 110, top: 0, bottom: 20, width: 50, height: 20 }
    ];

    expect(getInsertionIndex("horizontal", { x: 20, y: 10 }, itemRects)).toBe(0);
    expect(getInsertionIndex("horizontal", { x: 95, y: 10 }, itemRects)).toBe(2);
  });
});

describe("getDistanceToRect", () => {
  it("is zero when the pointer is inside the rect", () => {
    expect(
      getDistanceToRect(10, 10, {
        left: 0,
        right: 20,
        top: 0,
        bottom: 20,
        width: 20,
        height: 20
      })
    ).toBe(0);
  });

  it("returns squared distance when the pointer is outside the rect", () => {
    expect(
      getDistanceToRect(30, 40, {
        left: 0,
        right: 10,
        top: 0,
        bottom: 10,
        width: 10,
        height: 10
      })
    ).toBe(1300);
  });
});

describe("getKeyboardMoveTarget", () => {
  it("moves within a vertical container", () => {
    const containers = createContainers();

    expect(
      getKeyboardMoveTarget(
        containers,
        { containerId: "todo", index: 1 },
        "ArrowUp"
      )
    ).toEqual({ containerId: "todo", index: 0 });

    expect(
      getKeyboardMoveTarget(
        containers,
        { containerId: "todo", index: 1 },
        "ArrowDown"
      )
    ).toEqual({ containerId: "todo", index: 2 });
  });

  it("moves across vertical containers", () => {
    const containers = createContainers();

    expect(
      getKeyboardMoveTarget(
        containers,
        { containerId: "todo", index: 1 },
        "ArrowRight"
      )
    ).toEqual({ containerId: "done", index: 1 });

    expect(
      getKeyboardMoveTarget(
        containers,
        { containerId: "done", index: 0 },
        "ArrowLeft"
      )
    ).toEqual({ containerId: "todo", index: 0 });
  });

  it("uses horizontal arrow rules for horizontal containers", () => {
    const containers = createContainers();

    expect(
      getKeyboardMoveTarget(
        containers,
        { containerId: "todo", index: 1 },
        "ArrowLeft",
        () => "horizontal"
      )
    ).toEqual({ containerId: "todo", index: 0 });

    expect(
      getKeyboardMoveTarget(
        containers,
        { containerId: "todo", index: 1 },
        "ArrowDown",
        () => "horizontal"
      )
    ).toEqual({ containerId: "done", index: 1 });
  });
});

describe("getAutoScrollDelta", () => {
  it("returns negative delta near the leading edge", () => {
    expect(
      getAutoScrollDelta(12, 0, 200, {
        threshold: 40,
        maxSpeed: 24
      })
    ).toBeLessThan(0);
  });

  it("returns positive delta near the trailing edge", () => {
    expect(
      getAutoScrollDelta(194, 0, 200, {
        threshold: 40,
        maxSpeed: 24
      })
    ).toBeGreaterThan(0);
  });

  it("returns zero away from the edges", () => {
    expect(
      getAutoScrollDelta(100, 0, 200, {
        threshold: 40,
        maxSpeed: 24
      })
    ).toBe(0);
  });
});

describe("resolveDragStartDelay", () => {
  it("supports a shared numeric delay", () => {
    expect(resolveDragStartDelay("touch", 180)).toEqual({
      delay: 180,
      tolerance: 8
    });
  });

  it("resolves pointer-specific delays", () => {
    expect(
      resolveDragStartDelay("touch", {
        touch: 220,
        mouse: 0,
        tolerance: 10
      })
    ).toEqual({
      delay: 220,
      tolerance: 10
    });
  });

  it("falls back to zero delay when unset", () => {
    expect(resolveDragStartDelay("mouse")).toEqual({
      delay: 0,
      tolerance: 8
    });
  });
});
