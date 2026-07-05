"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { ChatContainer } from "@/features/chat/chat-container";

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />

      <main className="flex flex-1 flex-col">
        <TopBar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <ChatContainer />
      </main>
    </div>
  );
}
