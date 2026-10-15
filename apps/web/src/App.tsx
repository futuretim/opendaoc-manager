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
import { LootTemplateDetailPage } from "./pages/LootTemplateDetailPage";
import { LootTemplatesPage } from "./pages/LootTemplatesPage";
import { LoginPage } from "./pages/LoginPage";
import { MerchantListDetailPage } from "./pages/MerchantListDetailPage";
import { MerchantListsPage } from "./pages/MerchantListsPage";
import { MobDetailPage } from "./pages/MobDetailPage";
import { MobsPage } from "./pages/MobsPage";
import { NpcTemplateDetailPage } from "./pages/NpcTemplateDetailPage";
import { NpcTemplatesPage } from "./pages/NpcTemplatesPage";
import { QuestDetailPage } from "./pages/QuestDetailPage";
import { QuestsPage } from "./pages/QuestsPage";
import { SpellDetailPage } from "./pages/SpellDetailPage";
import { SpellsPage } from "./pages/SpellsPage";
import { StaffPage } from "./pages/StaffPage";
import { StyleDetailPage } from "./pages/StyleDetailPage";
import { StylesPage } from "./pages/StylesPage";

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
              <Route path="/mobs" element={<MobsPage />} />
              <Route path="/mobs/:id" element={<MobDetailPage />} />
              <Route path="/npc-templates" element={<NpcTemplatesPage />} />
              <Route path="/npc-templates/:templateId" element={<NpcTemplateDetailPage />} />
              <Route path="/loot-templates" element={<LootTemplatesPage />} />
              <Route path="/loot-templates/:name" element={<LootTemplateDetailPage />} />
              <Route path="/merchant-lists" element={<MerchantListsPage />} />
              <Route path="/merchant-lists/:id" element={<MerchantListDetailPage />} />
              <Route path="/spells" element={<SpellsPage />} />
              <Route path="/spells/:id" element={<SpellDetailPage />} />
              <Route path="/styles" element={<StylesPage />} />
              <Route path="/styles/:id" element={<StyleDetailPage />} />
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
