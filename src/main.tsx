import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";

import { I18nProvider } from "./lib/i18n.tsx";
import { Layout } from "./components/Layout.tsx";
import Home from "./pages/Home.tsx";
import Leaderboard from "./pages/Leaderboard.tsx";
import Detail from "./pages/Detail.tsx";
import Compare from "./pages/Compare.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="compare" element={<Compare />} />
            <Route path="s/:pack/:ver/:file" element={<Detail />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </HashRouter>
    </I18nProvider>
  </StrictMode>
);
