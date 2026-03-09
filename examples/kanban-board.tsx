import * as React from "react";
import { useDragDrop, type DragContainer } from "../src";

type Task = {
  id: string;
  title: string;
  assignee: string;
};

const initialData: DragContainer<Task>[] = [
  {
    id: "todo",
    items: [
      { id: "t-1", title: "Design API", assignee: "Ada" },
      { id: "t-2", title: "Write README", assignee: "Lin" }
    ]
  },
  {
    id: "doing",
    items: [{ id: "t-3", title: "Build demo", assignee: "Kai" }]
  },
  {
    id: "done",
    items: []
  }
];

export function KanbanBoardExample() {
  const [containers, setContainers] = React.useState(initialData);
  const dragDrop = useDragDrop({
    containers,
    getItemId: (item) => item.id,
    onChange: (nextContainers) => setContainers(nextContainers)
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(220px, 1fr))",
        gap: 16,
        alignItems: "start"
      }}
    >
      {containers.map((container) => (
        <section
          key={container.id}
          {...dragDrop.getContainerProps(container.id, {
            style: {
              minHeight: 260,
              padding: 16,
              borderRadius: 18,
              background: "#f8fafc",
              border: "1px solid #e2e8f0"
            }
          })}
        >
          <header style={{ marginBottom: 12, fontWeight: 700 }}>
            {container.id.toUpperCase()}
          </header>
          <div style={{ display: "grid", gap: 12 }}>
            {container.items.map((item) => (
              <article
                key={item.id}
                {...dragDrop.getItemProps(container.id, item.id, {
                  style: {
                    padding: 14,
                    borderRadius: 14,
                    background: "#ffffff",
                    border: "1px solid #cbd5e1"
                  }
                })}
              >
                <div style={{ fontWeight: 600 }}>{item.title}</div>
                <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>
                  {item.assignee}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
