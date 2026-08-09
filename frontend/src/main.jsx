import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import Admin from "./Admin.jsx";

// No router dependency for a two-page app: /admin is the internal asset
// portal (served via a vercel.json rewrite), everything else is the funnel.
const isAdminRoute = window.location.pathname.replace(/\/+$/, "") === "/admin";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isAdminRoute ? <Admin /> : <App />}
  </StrictMode>
);
