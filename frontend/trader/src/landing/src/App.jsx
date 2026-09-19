import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";

import HomePage         from "@/pages/HomePage";
import MarketsPage      from "@/pages/MarketsPage";
import CurrenciesPage   from "@/pages/CurrenciesPage";
import IndicesPage      from "@/pages/IndicesPage";
import CfdsPage         from "@/pages/CfdsPage";
import CommoditiesPage  from "@/pages/CommoditiesPage";
import CryptoPage       from "@/pages/CryptoPage";
import TradingPage      from "@/pages/TradingPage";
import AccountsPage         from "@/pages/AccountsPage";
import AccountDetailPage    from "@/pages/AccountDetailPage";
import TryDemoPage          from "@/pages/TryDemoPage";
import EducationPage    from "@/pages/EducationPage";
import ToolsPage        from "@/pages/ToolsPage";
import CompanyPage      from "@/pages/CompanyPage";
import SupportPage      from "@/pages/SupportPage";
import OpenAccountPage  from "@/pages/OpenAccountPage";
import PartnershipPage  from "@/pages/PartnershipPage";
import LegalPage        from "@/pages/LegalPage";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);
  return null;
}

function Layout() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";

  return (
    <div className="bg-background text-foreground min-h-screen">
      <Navbar />
      <ScrollToTop />
      <main className={isHome ? "" : "pt-24"}>
        <Outlet />
      </main>
      <WhatsAppFloat />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/"                         element={<HomePage />} />
          <Route path="/platform"                 element={<TradingPage />} />
          <Route path="/markets"                  element={<MarketsPage />} />
          <Route path="/markets/currencies"       element={<CurrenciesPage />} />
          <Route path="/markets/indices"          element={<IndicesPage />} />
          <Route path="/markets/cfds"             element={<CfdsPage />} />
          <Route path="/markets/commodities"      element={<CommoditiesPage />} />
          <Route path="/markets/crypto"           element={<CryptoPage />} />
          <Route path="/accounts"                          element={<AccountsPage />} />
          {/* Retired account products. These pages looked their slug up in
              ACCOUNT_TYPES, which now holds the platform's real account groups
              (Cent / ECN / Islamic / Standard / VIP), found nothing, and fell
              back to the first entry — so every one of them was headed "Cent".
              Nothing on the site links here any more; redirect old bookmarks
              and search results to the account that replaced each product. */}
          <Route path="/accounts/pro-standard-stp"         element={<Navigate to="/accounts/standard" replace />} />
          <Route path="/accounts/ecn-commission-free"      element={<Navigate to="/accounts/ecn" replace />} />
          <Route path="/accounts/proline-premium"          element={<Navigate to="/accounts/proline-vip" replace />} />
          <Route path="/accounts/crest"                    element={<Navigate to="/accounts" replace />} />
          <Route path="/accounts/demo"                     element={<TryDemoPage />} />
          <Route path="/accounts/:slug"                    element={<AccountDetailPage />} />
          <Route path="/education"                element={<EducationPage />} />
          <Route path="/tools"                    element={<ToolsPage />} />
          <Route path="/about"                    element={<CompanyPage />} />
          <Route path="/contact"                  element={<SupportPage />} />
          <Route path="/partnership"              element={<PartnershipPage />} />
          <Route path="/open-account"             element={<OpenAccountPage />} />
          <Route path="/:slug"                    element={<LegalPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
