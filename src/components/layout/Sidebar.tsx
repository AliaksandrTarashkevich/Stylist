"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shirt, LayoutGrid, Heart, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Builder", icon: Shirt },
  { href: "/closet", label: "Closet", icon: LayoutGrid },
  { href: "/outfits", label: "Outfits", icon: Heart },
  { href: "/history", label: "History", icon: Clock },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r bg-card flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold tracking-tight">Stylist</h1>
        <p className="text-xs text-muted-foreground">Virtual Try-On</p>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t text-xs text-muted-foreground">
        RPG Character Creator
      </div>
    </aside>
  );
}
