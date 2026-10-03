import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Sidebar } from "./Sidebar";
import "../styles/global.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Sidebar />
    </StrictMode>
  );
}
