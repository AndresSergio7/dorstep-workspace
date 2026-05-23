import Sidebar from "@/components/layout/Sidebar";
import { Metadata } from "next";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-56 p-8 min-h-screen">{children}</main>
    </div>
  );
}
