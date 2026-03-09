# react-drag-container

`react-drag-container` 是一个无样式、受控的 React 拖拽容器 package，用来处理两类高频交互：

- 同一容器内项目重新排序
- 不同容器之间项目拖入和拖出

它基于原生 `pointer` 事件实现，不依赖 HTML5 Drag and Drop API，也不绑定任何视觉层。你可以把它接到卡片列表、看板、标签编辑器、表单构建器、低代码画布等场景里。

## 特性

- React `>=16.8`
- 支持桌面鼠标和触屏拖拽
- 支持键盘拖拽
- 同容器排序
- 跨容器移动
- 空容器可接收拖拽项目
- Headless API，UI 完全由业务层控制
- 支持容器维度配置为纵向或横向
- 完整 TypeScript 类型导出

## 安装

```bash
npm install react-drag-container
```

## 核心概念

这个包采用受控模式，拖拽状态和数据更新职责分离：

1. 你提供 `containers` 作为当前真实数据。
2. 你提供 `getItemId` 告诉库如何识别每个项目。
3. 拖拽过程中只要顺序或容器发生变化，库就调用 `onChange`。
4. 你在 `onChange` 里把新的 `containers` 回写到 React state。

也就是说，这个库只负责“判断拖到哪里”和“计算移动后的结构”，不负责替你持久化状态。

## 快速开始

```tsx
import * as React from "react";
import { useDragDrop, type DragContainer } from "react-drag-container";

type Task = {
  id: string;
  title: string;
};

const initialData: DragContainer<Task>[] = [
  {
    id: "todo",
    items: [
      { id: "t-1", title: "Write docs" },
      { id: "t-2", title: "Ship package" }
    ]
  },
  {
    id: "doing",
    items: [{ id: "t-3", title: "Build drag layer" }]
  },
  {
    id: "done",
    items: []
  }
];

export function Board() {
  const [containers, setContainers] = React.useState(initialData);

  const dragDrop = useDragDrop({
    containers,
    getItemId: (item) => item.id,
    onChange: (nextContainers) => {
      setContainers(nextContainers);
    }
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16
      }}
    >
      {containers.map((container) => (
        <section
          key={container.id}
          {...dragDrop.getContainerProps(container.id, {
            style: {
              minHeight: 240,
              padding: 16,
              borderRadius: 16,
              background: "#f8fafc",
              border: "1px solid #e2e8f0"
            }
          })}
        >
          <h3>{container.id}</h3>

          <div style={{ display: "grid", gap: 12 }}>
            {container.items.map((item) => (
              <article
                key={item.id}
                {...dragDrop.getItemProps(container.id, item.id, {
                  style: {
                    padding: 12,
                    borderRadius: 12,
                    background: "#ffffff",
                    border: "1px solid #cbd5e1"
                  }
                })}
              >
                {item.title}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

## 使用说明

### 1. 准备数据结构

每个拖拽容器都需要一个稳定的容器 id，以及一个项目数组：

```ts
type DragContainer<T> = {
  id: string;
  items: T[];
};
```

项目本身的数据结构不限，只要你能通过 `getItemId` 返回稳定唯一值即可。

```ts
type Card = {
  id: string;
  title: string;
  status: "todo" | "doing" | "done";
};
```

### 2. 调用 `useDragDrop`

```tsx
const dragDrop = useDragDrop<Card>({
  containers,
  getItemId: (item) => item.id,
  onChange: (nextContainers, operation) => {
    setContainers(nextContainers);
    console.log(operation);
  }
});
```

### 3. 给容器根节点绑定 `getContainerProps`

```tsx
<section {...dragDrop.getContainerProps(container.id)}>
  ...
</section>
```

这个 `ref` 很重要。库会通过它读取容器的实际 DOM 尺寸，判断当前指针更接近哪个容器。

### 4. 给每个可拖拽项目绑定 `getItemProps`

```tsx
<article {...dragDrop.getItemProps(container.id, item.id)}>
  {item.title}
</article>
```

这里会绑定：

- `ref`，用于读取项目位置
- `onPointerDown`，作为拖拽启动入口
- 默认拖动态样式，如 `cursor`、`transform`、`z-index`

### 5. 在 `onChange` 中回写状态

如果你不回写，页面就不会反映新的排序结果。

```tsx
const [containers, setContainers] = React.useState(initialData);

const dragDrop = useDragDrop({
  containers,
  getItemId: (item) => item.id,
  onChange: (nextContainers) => setContainers(nextContainers)
});
```

## 横向容器

默认容器排序方向是 `vertical`。如果你的容器内部是横向排列，需要通过 `getContainerAxis` 显式声明：

```tsx
const dragDrop = useDragDrop({
  containers,
  getItemId: (item) => item.id,
  getContainerAxis: (containerId) =>
    containerId === "tag-row" ? "horizontal" : "vertical",
  onChange: (nextContainers) => setContainers(nextContainers)
});
```

横向布局示例见 [examples/horizontal-list.tsx](/Users/adib/Desktop/practices/react-drag/examples/horizontal-list.tsx)。

## 键盘操作

内置支持键盘拖拽，默认交互规则如下：

- `Space` 或 `Enter`
  聚焦项目后按一次开始拖拽，再按一次完成放置。
- `Escape`
  取消当前拖拽状态。
- 纵向容器：
  `ArrowUp` / `ArrowDown` 在当前容器内排序，`ArrowLeft` / `ArrowRight` 在容器数组顺序之间移动。
- 横向容器：
  `ArrowLeft` / `ArrowRight` 在当前容器内排序，`ArrowUp` / `ArrowDown` 在容器数组顺序之间移动。

说明：

- 跨容器键盘移动依赖 `containers` 数组顺序来决定前后容器
- 如果目标方向上没有可移动位置，按键会被忽略

## 完整 API

### `useDragDrop<T>(options)`

签名：

```ts
function useDragDrop<T>(options: UseDragDropOptions<T>): UseDragDropResult;
```

### `UseDragDropOptions<T>`

```ts
type UseDragDropOptions<T> = {
  containers: readonly DragContainer<T>[];
  getItemId: (item: T) => string | number;
  onChange: (
    nextContainers: DragContainer<T>[],
    operation: DragDropOperation<T>
  ) => void;
  onDragStart?: (operation: DragDropOperation<T>) => void;
  onDragEnd?: (operation: DragDropOperation<T>) => void;
  getContainerAxis?: (containerId: string) => "vertical" | "horizontal";
  disabled?: boolean;
};
```

属性说明：

- `containers`
  当前受控数据源。你每次渲染传进来的都应该是真实状态。
- `getItemId`
  返回项目唯一标识。必须稳定，不能在拖拽过程中变化。
- `onChange`
  拖拽过程中只要顺序发生变化就会触发。返回新的容器数据和拖拽操作信息。
- `onDragStart`
  拖拽开始时触发一次。
- `onDragEnd`
  成功释放指针并结束拖拽时触发一次。
- `getContainerAxis`
  指定某个容器内的排序维度。默认是 `vertical`。
- `disabled`
  全局禁用当前 hook 管理的所有拖拽项目。

### `DragContainer<T>`

```ts
type DragContainer<T> = {
  id: string;
  items: T[];
};
```

属性说明：

- `id`
  容器唯一标识。
- `items`
  容器内部项目列表。`onChange` 会返回新的数组顺序。

### `DragDropOperation<T>`

```ts
type DragDropOperation<T> = {
  item: T;
  itemId: string;
  from: {
    containerId: string;
    index: number;
  };
  to: {
    containerId: string;
    index: number;
  };
};
```

属性说明：

- `item`
  当前拖拽项目的业务对象。
- `itemId`
  字符串化后的项目 id。
- `from`
  拖拽起点位置。
- `to`
  当前或最终落点位置。

### `UseDragDropResult`

```ts
type UseDragDropResult = {
  getContainerProps: (
    containerId: string,
    options?: { style?: React.CSSProperties }
  ) => DragContainerProps;
  getItemProps: (
    containerId: string,
    itemId: string | number,
    options?: {
      disabled?: boolean;
      style?: React.CSSProperties;
    }
  ) => DragItemProps;
  snapshot: DragSnapshot;
  cancelDrag: () => void;
};
```

属性说明：

- `getContainerProps`
  生成容器根节点需要绑定的属性。
- `getItemProps`
  生成每个可拖拽项目需要绑定的属性。
- `snapshot`
  暴露当前拖拽状态，适合做高亮、占位提示、调试面板。
- `cancelDrag`
  主动取消当前拖拽。

### `getContainerProps(containerId, options?)`

返回：

```ts
type DragContainerProps = {
  ref: (node: HTMLElement | null) => void;
  "data-drag-container-id": string;
  style?: React.CSSProperties;
};
```

参数说明：

- `containerId`
  当前容器 id，必须和 `containers` 中保持一致。
- `options.style`
  直接注入到容器节点上的样式对象。

### `getItemProps(containerId, itemId, options?)`

返回：

```ts
type DragItemProps = {
  ref: (node: HTMLElement | null) => void;
  onPointerDown: React.PointerEventHandler<HTMLElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLElement>;
  "data-drag-item-id": string;
  "data-drag-container-id": string;
  role: "button";
  tabIndex: number;
  "aria-grabbed": boolean;
  style?: React.CSSProperties;
};
```

参数说明：

- `containerId`
  项目当前所在容器 id。
- `itemId`
  当前项目 id。
- `options.disabled`
  仅禁用当前项目的拖拽能力。
- `options.style`
  追加项目样式。会和内置拖动态样式合并。

默认会注入以下拖动态样式：

- `touchAction: "none"`
- `cursor: "grab" | "grabbing"`
- 拖拽中使用 `transform: translate3d(...)`
- 拖拽中设置 `position: relative` 和较高 `z-index`

### `snapshot`

结构：

```ts
type DragSnapshot = {
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
};
```

字段说明：

- `activeItemId`
  当前正在拖拽的项目 id。
- `activeContainerId`
  当前项目所在容器 id。随着跨容器移动会更新。
- `overContainerId`
  当前指针命中的目标容器 id。
- `overIndex`
  当前计算出的目标插入位置。
- `isDragging`
  是否处于拖拽状态。
- `mode`
  当前拖拽模式，是 `pointer`、`keyboard` 或 `null`。
- `translate`
  当前项目相对拖拽起点的位移。

## 事件触发时机

### `onDragStart`

在用户通过指针按下项目，或通过键盘开始拖拽时触发一次。此时：

- `from.containerId === to.containerId`
- `from.index === to.index`

### `onChange`

只要目标落点变化且真正发生位置变动就会触发。典型场景包括：

- 在同一容器内向前或向后排序
- 从 A 容器移入 B 容器
- 拖入空容器

### `onDragEnd`

在释放指针完成拖拽后触发一次，返回最终位置。

注意：

- 如果拖拽被 `pointercancel` 或主动 `cancelDrag()` 中断，不会触发 `onDragEnd`
- `onChange` 可能在一次拖拽过程中触发多次

## 实现原理

这个库内部主要分成 4 个步骤：

### 1. 拖拽启动

项目节点同时绑定了 `onPointerDown` 和 `onKeyDown`。用户通过指针或键盘启动拖拽后，库会：

- 记录当前项目、起始容器、起始索引，以及触发来源
- 指针拖拽时记录按下时的 `clientX/clientY`
- 指针拖拽时给 `document` 绑定 `pointermove`、`pointerup`、`pointercancel`
- 指针拖拽时锁定 `body.style.userSelect = "none"`，避免拖拽过程中选中文字

如果是键盘拖拽，则不会绑定指针移动事件，而是通过方向键直接计算下一个目标位置。

### 2. 命中容器

每次 `pointermove` 时，库会读取每个容器根节点的 `getBoundingClientRect()`：

- 如果指针在某个容器矩形内，直接认为它是当前命中容器
- 如果指针暂时离开所有容器，则选择距离最近的容器

这样做的目的是让容器边缘附近的拖拽更稳定，尤其适合看板类布局。

### 3. 计算插入位置

确定容器后，库会遍历该容器下的项目 DOM 节点，根据排序方向判断插入索引：

- `vertical` 时使用每个项目矩形的垂直中心线
- `horizontal` 时使用每个项目矩形的水平中心线

当指针越过某个项目中心线时，插入索引就会更新。空容器会直接返回 `index = 0`。

### 4. 生成新数据并回调

一旦目标位置变化，库会：

- 克隆当前容器数组
- 从源容器移除项目
- 插入目标容器的目标索引
- 调用 `onChange(nextContainers, operation)`

因为整个过程是受控的，所以最终 UI 是否更新，由你是否把 `nextContainers` 写回状态决定。

## 状态管理建议

### 本地组件状态

最简单的方式就是 `useState`：

```tsx
const [containers, setContainers] = React.useState(initialData);
```

### 外部状态库

如果你用 Zustand、Redux、Jotai 之类状态库，也只需要把 `onChange` 指向对应的更新函数即可。

```tsx
const dragDrop = useDragDrop({
  containers,
  getItemId: (item) => item.id,
  onChange: boardStore.replaceContainers
});
```

## 样式建议

- 容器最好显式设置 `minHeight`，否则空容器视觉上很难作为拖入目标
- 项目建议使用 `display: block`、`display: grid` 或 `display: flex`
- 拖拽项目最好避免 `overflow: hidden` 的复杂嵌套祖先，否则视觉位移可能被裁切
- 如果你需要更强的拖拽反馈，可以结合 `snapshot` 自己渲染占位样式或目标高亮

## 限制与注意事项

- 当前版本不会自动渲染占位元素，需要业务层按 `snapshot` 自己扩展
- 如果同一个容器里项目 id 不唯一，排序行为会不稳定
- 如果多个容器共享同一个 `itemId`，建议业务层仍然保证全局唯一，避免调试复杂度上升

## 仓库示例

- 看板示例：[examples/kanban-board.tsx](/Users/adib/Desktop/practices/react-drag/examples/kanban-board.tsx)
- 横向标签示例：[examples/horizontal-list.tsx](/Users/adib/Desktop/practices/react-drag/examples/horizontal-list.tsx)

## 本地调试

启动交互 playground：

```bash
npm run playground
```

默认地址：

```text
http://127.0.0.1:4173/
```

playground 同时演示了：

- 纵向看板拖拽
- 横向标签拖拽
- 拖拽事件日志输出
- 空容器拖入场景

## 测试

运行单元测试：

```bash
npm run test
```

监听模式：

```bash
npm run test:watch
```

当前测试覆盖：

- 同容器内排序
- 跨容器移动
- 空容器接收项目
- 插入索引计算
- 容器距离计算

## 开发

```bash
npm install
npm run test
npm run typecheck
npm run build
```
