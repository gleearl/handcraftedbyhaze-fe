import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { OrderProvider } from "./store/order";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OrderProvider>
      <App />
    </OrderProvider>
  </StrictMode>,
);
