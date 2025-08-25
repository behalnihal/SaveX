"use client";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="relative w-full flex justify-center py-6">
      <nav className="backdrop-blur-lg bg-white/10 dark:bg-slate-900/10 shadow-2xl border border-white/20 dark:border-slate-700/20 rounded-2xl py-4 px-6 flex justify-between items-center w-full max-w-3xl mx-4 floating-nav">
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="relative">
            <Image
              src="/savex.png"
              alt="SaveX Logo"
              height={45}
              width={45}
              className="transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 rounded-full bg-blue-400/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="text-xl font-bold text-slate-800 dark:text-slate-200 tracking-tight group-hover:text-blue-600 transition-colors duration-200">
            Save<span className="text-blue-600 dark:text-blue-400">X</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="bg-white/20 dark:bg-slate-800/20 border-white/30 dark:border-slate-600/30 hover:bg-white/30 dark:hover:bg-slate-700/30 transition-all duration-200 cursor-pointer backdrop-blur-sm"
          >
            {theme === "light" ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4" />
            )}
          </Button>
        </div>
      </nav>
    </div>
  );
}
