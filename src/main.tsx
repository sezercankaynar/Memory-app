import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AlbumProvider } from "./context/AlbumContext";
import App from "./App";
import "mapbox-gl/dist/mapbox-gl.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AlbumProvider>
          <App />
        </AlbumProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
