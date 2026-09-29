import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import Admin from "./Admin.jsx";
import Kit from "./Kit.jsx";
import Booked from "./Booked.jsx";

// No router dependency for a small app: /admin is the internal asset
// portal, /kit is the emailed campaign-kit page, /booked is where the GHL
// calendar redirects after a booking (all served via vercel.json rewrites),
// everything else is the funnel.
const route = window.location.pathname.replace(/\/+$/, "");
const Page = route === "/admin" ? Admin : route === "/kit" ? Kit : route === "/booked" ? Booked : App;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Page />
  </StrictMode>
);
