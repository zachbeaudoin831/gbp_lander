import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import Admin from "./Admin.jsx";
import Kit from "./Kit.jsx";

// No router dependency for a three-page app: /admin is the internal asset
// portal, /kit is the emailed campaign-kit page (both served via vercel.json
// rewrites), everything else is the funnel.
const route = window.location.pathname.replace(/\/+$/, "");
const Page = route === "/admin" ? Admin : route === "/kit" ? Kit : App;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Page />
  </StrictMode>
);
