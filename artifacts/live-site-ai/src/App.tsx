import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import DemoForm from "@/pages/demo-form";
import DemoDetail from "@/pages/demo-detail";
import Settings from "@/pages/settings";
import PublicDemo from "@/pages/public-demo";
import { ProtectedRoute } from "@/components/protected-route";
import { AppSidebar } from "@/components/layout/app-sidebar";
import Signup from "@/pages/signup";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/demo/:slug" component={PublicDemo} />
      
      {/* App Routes */}
      <Route path="/dashboard">
        <ProtectedRoute>
          <AppSidebar>
            <Dashboard />
          </AppSidebar>
        </ProtectedRoute>
      </Route>

      <Route path="/demos/new">
        <ProtectedRoute>
          <AppSidebar>
            <DemoForm />
          </AppSidebar>
        </ProtectedRoute>
      </Route>

      <Route path="/demos/:id/edit">
        <ProtectedRoute>
          <AppSidebar>
            <DemoForm />
          </AppSidebar>
        </ProtectedRoute>
      </Route>

      <Route path="/demos/:id">
        <ProtectedRoute>
          <AppSidebar>
            <DemoDetail />
          </AppSidebar>
        </ProtectedRoute>
      </Route>

      <Route path="/settings">
        <ProtectedRoute>
          <AppSidebar>
            <Settings />
          </AppSidebar>
        </ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
