import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AccountDetailPage } from "./pages/AccountDetailPage";
import { AccountsPage } from "./pages/AccountsPage";
import { BansPage } from "./pages/BansPage";
import { CharacterDetailPage } from "./pages/CharacterDetailPage";
import { CharactersPage } from "./pages/CharactersPage";
import { LoginPage } from "./pages/LoginPage";

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
              <Route path="/bans" element={<BansPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
