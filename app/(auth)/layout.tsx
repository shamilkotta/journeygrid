import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

type AuthLayoutProps = {
  children: ReactNode;
};

const AuthLayout = ({ children }: AuthLayoutProps) => (
  <div className="pointer-events-auto fixed inset-0 z-50 flex min-h-screen flex-col bg-background">
    <header className="flex h-14 items-center border-b px-4">
      <Link className="flex items-center gap-2" href="/">
        <Logo className="size-6" />
        <span className="font-semibold">journeygrid</span>
      </Link>
    </header>
    <main className="flex flex-1 items-center justify-center p-4">
      {children}
    </main>
  </div>
);

export default AuthLayout;
