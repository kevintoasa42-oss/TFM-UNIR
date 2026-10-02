"use client";

import { useState } from "react";
import { GraduationCap, LockKeyhole } from "lucide-react";
import { apiClient, type Account } from "@/infrastructure/api-client";
import type { Role } from "@/domain/auth";

export function AuthView({ onLogin }: { onLogin: (user: Account) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setWorking(true);
    try {
      const result = mode === "register"
        ? await apiClient.register(name, email, password, role)
        : await apiClient.login(email, password);
      onLogin(result.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-art">
        <div className="auth-brand">
          <span className="brand-mark"><GraduationCap size={26} /></span> flash<span>reto</span>
        </div>
        <div>
          <span className="eyebrow">APRENDE JUGANDO</span>
          <h1>Convierte tus preguntas en grandes retos.</h1>
          <p>Crea exámenes, estudia con tarjetas y juega con otra persona en tiempo real.</p>
        </div>
        <div className="auth-illustration" aria-hidden="true">
          <div>¿Cuál es la respuesta?</div>
          <span>A</span><span>B</span><span>C ✓</span><span>D</span>
        </div>
      </div>
      <main className="auth-main">
        <form className="auth-card" onSubmit={submit}>
          <span className="auth-icon"><LockKeyhole size={23} /></span>
          <span className="eyebrow">TU ESPACIO DE APRENDIZAJE</span>
          <h2>{mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}</h2>
          <p>{mode === "login" ? "Inicia sesión para continuar donde lo dejaste." : "Elige cómo quieres usar FlashReto."}</p>
          {mode === "register" && (
            <label>
              Nombre
              <input autoComplete="name" required minLength={2} maxLength={80} disabled={working} value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" />
            </label>
          )}
          <label>
            Correo electrónico
            <input type="email" autoComplete="email" required maxLength={254} disabled={working} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@ejemplo.com" />
          </label>
          <label>
            Contraseña
            <input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={8} maxLength={128} disabled={working} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" />
          </label>
          {mode === "register" && (
            <div>
              <label>
                Tipo de cuenta
                <select name="role" required disabled={working} value={role} aria-describedby="role-description" onChange={(event) => setRole(event.target.value as Role)}>
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </label>
              <p id="role-description" className="auth-role-description">
                {role === "admin"
                  ? "Crea preguntas y exámenes, administra usuarios y organiza partidas."
                  : "Participa en partidas con el código que comparta un administrador."}
              </p>
            </div>
          )}
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="primary-button" type="submit" disabled={working}>
            {working ? "Espera un momento…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
          <p className="auth-switch">
            {mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
            <button type="button" disabled={working} onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
              {mode === "login" ? "Regístrate" : "Inicia sesión"}
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}
