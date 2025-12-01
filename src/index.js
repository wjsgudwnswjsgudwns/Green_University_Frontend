import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/common.css";

// Render the top level component into the root element.
// ReactDOM.render is deprecated in React 18, so we use createRoot instead.
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
