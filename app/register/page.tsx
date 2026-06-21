import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold leading-tight">
            VoltaDigital<span className="text-[color:var(--color-accent)]">CRM</span>
          </h1>
          <p className="text-sm text-[color:var(--color-muted)] mt-3">
            Account erstellen. Email muss vorab autorisiert sein.
          </p>
        </div>
        <RegisterForm />
      </div>
    </main>
  );
}
