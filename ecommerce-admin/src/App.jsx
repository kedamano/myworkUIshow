import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { navItems } from "./nav-items";
import AppLayout from "./components/layout/AppLayout";
import { StaffProvider } from "./contexts/StaffContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster position="top-center" />
      <HashRouter>
        <StaffProvider>
          <Routes>
            <Route element={<AppLayout />}>
              {navItems.map(({ to, page }) => (
                <Route key={to} path={to} element={page} />
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </StaffProvider>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
