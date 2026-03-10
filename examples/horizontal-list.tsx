import * as React from "react";
import { useDragDrop, type DragContainer } from "../src";

type Tag = {
  id: string;
  label: string;
};

const initialTags: DragContainer<Tag>[] = [
  {
    id: "priority",
    items: [
      { id: "p1", label: "Urgent" },
      { id: "p2", label: "Backend" },
      { id: "p3", label: "Frontend" }
    ]
  },
  {
    id: "secondary",
    items: [{ id: "p4", label: "Research" }]
  }
];

export function HorizontalListExample() {
  const [containers, setContainers] = React.useState(initialTags);
  const dragDrop = useDragDrop({
    containers,
    getItemId: (item) => item.id,
    getContainerAxis: () => "horizontal",
    onChange: (nextContainers) => setContainers(nextContainers)
  });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {containers.map((container) => (
        <section
          key={container.id}
          {...dragDrop.getContainerProps(container.id, {
            style: {
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              minHeight: 72,
              padding: 16,
              borderRadius: 16,
              background: "#f1f5f9"
            }
          })}
        >
          {container.items.map((item, index) => (
            <React.Fragment key={item.id}>
              <span
                {...dragDrop.getPlaceholderProps(container.id, index, {
                  style: {
                    minHeight: 40
                  },
                  activeStyle: {
                    minWidth: 16,
                    background: "#e2e8f0"
                  }
                })}
              />
              <span
                {...dragDrop.getItemProps(container.id, item.id, {
                  style: {
                    display: "inline-flex",
                    alignItems: "center",
                    minHeight: 40,
                    padding: "0 14px",
                    borderRadius: 999,
                    background: "#0f172a",
                    color: "#ffffff"
                  }
                })}
              >
                {item.label}
              </span>
            </React.Fragment>
          ))}
          <span
            {...dragDrop.getPlaceholderProps(container.id, container.items.length, {
              style: {
                minHeight: 40
              },
              activeStyle: {
                minWidth: 16,
                background: "#e2e8f0"
              }
            })}
          />
        </section>
      ))}
    </div>
  );
}
