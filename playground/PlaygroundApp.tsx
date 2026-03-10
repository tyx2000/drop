import * as React from "react";
import { useDragDrop, type DragContainer, type DragDropOperation } from "../src";

type Task = {
  id: string;
  title: string;
  owner: string;
  points: number;
};

type Tag = {
  id: string;
  label: string;
};

const initialBoard: DragContainer<Task>[] = [
  {
    id: "backlog",
    items: [
      { id: "t-1", title: "Refine package exports", owner: "Ada", points: 3 },
      { id: "t-2", title: "Add keyboard API", owner: "Lin", points: 5 },
      { id: "t-4", title: "Document handle mode", owner: "Noa", points: 2 },
      { id: "t-5", title: "Ship auto scroll", owner: "Ivy", points: 3 },
      { id: "t-6", title: "Profile large lists", owner: "Moe", points: 5 },
      { id: "t-7", title: "Record release demo", owner: "Eli", points: 2 }
    ]
  },
  {
    id: "in-progress",
    items: [
      { id: "t-3", title: "Build playground", owner: "Kai", points: 2 },
      { id: "t-8", title: "Test touch drag", owner: "Zoe", points: 3 },
      { id: "t-9", title: "Tune insertion line", owner: "Uma", points: 1 }
    ]
  },
  {
    id: "done",
    items: []
  }
];

const initialTags: DragContainer<Tag>[] = [
  {
    id: "primary-tags",
    items: [
      { id: "tag-1", label: "React" },
      { id: "tag-2", label: "Sortable" },
      { id: "tag-3", label: "Touch" }
    ]
  },
  {
    id: "secondary-tags",
    items: [
      { id: "tag-4", label: "Package" },
      { id: "tag-5", label: "Headless" }
    ]
  }
];

function formatOperation<T>(operation: DragDropOperation<T>): string {
  return `${operation.itemId}: ${operation.from.containerId}[${operation.from.index}] -> ${operation.to.containerId}[${operation.to.index}]`;
}

export function PlaygroundApp() {
  const [board, setBoard] = React.useState(initialBoard);
  const [tags, setTags] = React.useState(initialTags);
  const [eventLog, setEventLog] = React.useState<string[]>([
    "Ready. Drag any card or tag."
  ]);

  const pushLog = React.useCallback((entry: string) => {
    setEventLog((current) => [entry, ...current].slice(0, 8));
  }, []);

  const boardDrag = useDragDrop({
    containers: board,
    getItemId: (item) => item.id,
    dragStartDelay: {
      touch: 180,
      tolerance: 10
    },
    onDragStart: (operation) => pushLog(`board start ${formatOperation(operation)}`),
    onChange: (nextContainers, operation) => {
      setBoard(nextContainers);
      pushLog(`board move ${formatOperation(operation)}`);
    },
    onDragEnd: (operation) => pushLog(`board end ${formatOperation(operation)}`)
  });

  const tagDrag = useDragDrop({
    containers: tags,
    getItemId: (item) => item.id,
    getContainerAxis: () => "horizontal",
    onDragStart: (operation) => pushLog(`tags start ${formatOperation(operation)}`),
    onChange: (nextContainers, operation) => {
      setTags(nextContainers);
      pushLog(`tags move ${formatOperation(operation)}`);
    },
    onDragEnd: (operation) => pushLog(`tags end ${formatOperation(operation)}`)
  });

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">react-drag-container</p>
        <h1>Pointer-driven drag containers for board and list UIs</h1>
        <p className="intro">
          This playground renders one vertical kanban board and one horizontal tag
          lane. Both use the same hook and controlled-data pattern.
        </p>
        <p className="helper-copy">
          Keyboard: focus an item, press Space or Enter to pick it up, use arrow
          keys to move it, then press Space, Enter, or Escape.
        </p>
        <p className="helper-copy">
          Pointer: drag cards near the top or bottom edge of a scrollable column to
          trigger auto-scroll.
        </p>
        <p className="helper-copy">
          Touch: cards in the board use a short long-press delay before drag starts.
        </p>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <p className="section-kicker">Vertical containers</p>
            <h2>Kanban board</h2>
          </div>
          <code className="mini-code">getContainerAxis: vertical</code>
        </div>

        <div className="board-grid">
          {board.map((container) => (
            <article
              key={container.id}
              className="column"
              {...boardDrag.getContainerProps(container.id)}
            >
              <header className="column-header">
                <span>{container.id}</span>
                <strong>{container.items.length}</strong>
              </header>

              <div className="card-list">
                {container.items.map((item, index) => (
                  <React.Fragment key={item.id}>
                    <div
                      className="placeholder-slot"
                      {...boardDrag.getPlaceholderProps(container.id, index)}
                    />
                    <section
                      className="task-card"
                      {...boardDrag.getItemProps(container.id, item.id, {
                        handleOnly: true
                      })}
                    >
                      <div className="task-topline">
                        <h3>{item.title}</h3>
                        <button
                          type="button"
                          className="drag-handle"
                          {...boardDrag.getHandleProps(container.id, item.id, {
                            ariaLabel: `Drag ${item.title}`
                          })}
                        >
                          ::
                        </button>
                      </div>
                      <p>{item.owner}</p>
                      <span>{item.points} pts</span>
                    </section>
                  </React.Fragment>
                ))}
                <div
                  className="placeholder-slot"
                  {...boardDrag.getPlaceholderProps(
                    container.id,
                    container.items.length
                  )}
                />
                {container.items.length === 0 ? (
                  <div className="empty-state">Drop card here</div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <p className="section-kicker">Horizontal containers</p>
            <h2>Tag lanes</h2>
          </div>
          <code className="mini-code">getContainerAxis: horizontal</code>
        </div>

        <div className="tag-area">
          {tags.map((container) => (
            <div
              key={container.id}
              className="tag-lane"
              {...tagDrag.getContainerProps(container.id)}
            >
              <span className="lane-label">{container.id}</span>
              <div className="tag-wrap">
                {container.items.map((item, index) => (
                  <React.Fragment key={item.id}>
                    <span
                      className="placeholder-chip"
                      {...tagDrag.getPlaceholderProps(container.id, index, {
                        style: {
                          minHeight: 42
                        },
                        activeStyle: {
                          minWidth: 18,
                          background: "#fde68a"
                        }
                      })}
                    />
                    <span
                      className="tag-chip"
                      {...tagDrag.getItemProps(container.id, item.id)}
                    >
                      {item.label}
                    </span>
                  </React.Fragment>
                ))}
                <span
                  className="placeholder-chip"
                  {...tagDrag.getPlaceholderProps(container.id, container.items.length, {
                    style: {
                      minHeight: 42
                    },
                    activeStyle: {
                      minWidth: 18,
                      background: "#fde68a"
                    }
                  })}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel log-panel">
        <div className="section-head">
          <div>
            <p className="section-kicker">Runtime inspection</p>
            <h2>Event log</h2>
          </div>
          <button type="button" className="clear-button" onClick={() => setEventLog([])}>
            Clear
          </button>
        </div>

        <div className="status-row">
          <span>
            board dragging: {String(boardDrag.snapshot.isDragging)} ({boardDrag.snapshot.mode ?? "idle"})
          </span>
          <span>
            tags dragging: {String(tagDrag.snapshot.isDragging)} ({tagDrag.snapshot.mode ?? "idle"})
          </span>
        </div>

        <pre className="log-box">{eventLog.join("\n") || "No events yet."}</pre>
      </section>
    </main>
  );
}
