import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout.tsx";
import Home from "./pages/Home.tsx";
import Leaderboard from "./pages/Leaderboard.tsx";
import Detail from "./pages/Detail.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="s/:id" element={<Detail />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>
);
