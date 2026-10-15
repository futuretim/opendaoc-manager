import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { AdminRoute } from "./components/AdminRoute";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AccountDetailPage } from "./pages/AccountDetailPage";
import { AccountsPage } from "./pages/AccountsPage";
import { BansPage } from "./pages/BansPage";
import { AuditPage } from "./pages/AuditPage";
import { CharacterDetailPage } from "./pages/CharacterDetailPage";
import { CharactersPage } from "./pages/CharactersPage";
import { ItemDetailPage } from "./pages/ItemDetailPage";
import { ItemsPage } from "./pages/ItemsPage";
import { LoginPage } from "./pages/LoginPage";
import { QuestDetailPage } from "./pages/QuestDetailPage";
import { QuestsPage } from "./pages/QuestsPage";
import { StaffPage } from "./pages/StaffPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/accounts" replace />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/accounts/:name" element={<AccountDetailPage />} />
              <Route path="/characters" element={<CharactersPage />} />
              <Route path="/characters/:name" element={<CharacterDetailPage />} />
              <Route path="/quests" element={<QuestsPage />} />
              <Route path="/quests/:id" element={<QuestDetailPage />} />
              <Route path="/items" element={<ItemsPage />} />
              <Route path="/items/:idNb" element={<ItemDetailPage />} />
              <Route path="/bans" element={<BansPage />} />
              <Route element={<AdminRoute />}>
                <Route path="/staff" element={<StaffPage />} />
                <Route path="/audit" element={<AuditPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
