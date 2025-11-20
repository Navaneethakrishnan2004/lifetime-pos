import { ChevronRight, Package, FileText, BarChart3, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import mcsLogo from "@/assets/mcs-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Billing", url: "/", icon: ChevronRight },
  { title: "Menu Management", url: "/menu", icon: Package },
  { title: "Previous Bills", url: "/bills", icon: FileText },
  { title: "Revenue Reports", url: "/reports", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  return (
    <Sidebar className="border-r">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden bg-background">
            <img src={mcsLogo} alt="MCS Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-sidebar-foreground">MCS Billing</h2>
            <p className="text-xs text-sidebar-foreground/70">Modern POS</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
                      activeClassName="bg-secondary text-primary font-medium"
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
