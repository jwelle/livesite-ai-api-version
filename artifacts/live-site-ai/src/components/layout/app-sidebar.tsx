import { useAuth } from "@workspace/replit-auth-web";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { LayoutDashboard, PlusCircle, Settings, LogOut, Code2, Shield, Users, FileText } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ReactNode } from "react";
import { ImpersonationBanner } from "@/components/impersonation-banner";

export function AppSidebar({ children }: { children: ReactNode }) {
  const { user, logout, isAdmin, impersonating } = useAuth();
  const [location] = useLocation();

  const handleLogout = () => {
    logout();
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-border bg-card">
          <SidebarHeader className="p-4 flex items-center gap-2 font-bold text-lg text-primary">
            <Code2 className="h-6 w-6" />
            <span>Live Site AI</span>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/dashboard"}>
                      <Link href="/dashboard" data-testid="link-dashboard">
                        <LayoutDashboard />
                        <span>Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/demos/new"}>
                      <Link href="/demos/new" data-testid="link-new-demo">
                        <PlusCircle />
                        <span>Create Demo</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/settings"}>
                      <Link href="/settings" data-testid="link-settings">
                        <Settings />
                        <span>Settings</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {isAdmin && !impersonating && (
              <SidebarGroup>
                <SidebarGroupLabel>Admin</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/admin/users"}>
                        <Link href="/admin/users" data-testid="link-admin-users">
                          <Users />
                          <span>Users</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/admin/demos"}>
                        <Link href="/admin/demos" data-testid="link-admin-demos">
                          <FileText />
                          <span>All Demos</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/admin/audit-log"}>
                        <Link href="/admin/audit-log" data-testid="link-admin-audit">
                          <Shield />
                          <span>Audit Log</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>
          <SidebarFooter className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="h-9 w-9 bg-primary/10">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="text-primary">{user?.firstName?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user?.firstName || "User"} {user?.lastName || ""}</span>
                <span className="text-xs text-muted-foreground truncate w-[120px]">{user?.email || ""}</span>
              </div>
            </div>
            <SidebarMenuButton onClick={handleLogout} className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" data-testid="btn-logout">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ImpersonationBanner />
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
