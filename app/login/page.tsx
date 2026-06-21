import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold leading-tight">
            VoltaDigital<span className="text-[color:var(--color-accent)]">CRM</span>
          </h1>
          <p className="text-sm text-[color:var(--color-muted)] mt-3">
            Login mit Email und Passwort. Nur autorisierte Accounts.
          </p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
