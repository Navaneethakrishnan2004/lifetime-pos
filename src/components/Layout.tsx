import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-xl font-semibold text-foreground">Billing System</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (document.documentElement.requestFullscreen && document.fullscreenElement) {
                    document.exitFullscreen();
                  }
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                title="Minimize"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to close?')) {
                    window.close();
                  }
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background hover:bg-destructive hover:text-destructive-foreground transition-colors"
                title="Close"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" strokeWidth="2" strokeLinecap="round" />
                  <line x1="6" y1="6" x2="18" y2="18" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
