import { FileText } from "lucide-react";
import type { ComponentType } from "react";
import { AppLayout } from "./components/AppLayout";
import { useHashRoute } from "./hooks/useHashRoute";
import { BulkRenamerPage } from "./pages/BulkRenamerPage";
import { CompressorPage } from "./pages/CompressorPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HistoryPage } from "./pages/HistoryPage";
import { RenamerPage } from "./pages/RenamerPage";
import type { AppRoute } from "./types/navigation";

const pageByRoute: Record<AppRoute, ComponentType> = {
  dashboard: DashboardPage,
  renamer: RenamerPage,
  compressor: CompressorPage,
  history: HistoryPage,
  "bulk-renamer": BulkRenamerPage,
};

export function App() {
  const { route, navigate } = useHashRoute();
  const Page = pageByRoute[route];

  return (
    <AppLayout
      activeRoute={route}
      brandIcon={<FileText aria-hidden="true" size={24} />}
      onNavigate={navigate}
    >
      <Page />
    </AppLayout>
  );
}
