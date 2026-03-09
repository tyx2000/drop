import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { PlaygroundApp } from "./PlaygroundApp";
import "./playground.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PlaygroundApp />
  </React.StrictMode>
);
