import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PetApp from "./PetApp";
import "./styles.css";

const isPet = new URLSearchParams(window.location.search).get("pet") === "1";
if (isPet) {
  document.body.classList.add("pet-mode");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isPet ? <PetApp /> : <App />}</React.StrictMode>,
);
