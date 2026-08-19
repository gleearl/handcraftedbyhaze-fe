import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { API_URL } from "./config";
import { AppRoutes } from "./routes";
import "./styles/index.css";

/* The same bundle is published twice: to the shop's domain for customers, and
   to the API's own host, which is where the admin has to be used.

   The admin's session is an httpOnly cookie belonging to the API's host. Opened
   from the shop's domain instead, the browser will not send it and will not let
   JS read the XSRF-TOKEN either — so the login answers 419 and every gated call
   answers 401, with nothing on screen explaining why. Sending the browser to
   the right origin is the only outcome that isn't a dead end. */
if (API_URL && location.pathname.startsWith("/admin") && location.origin !== API_URL) {
  location.replace(API_URL + location.pathname + location.search + location.hash);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>,
);
