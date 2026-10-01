"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Users } from "lucide-react";
import { apiClient, type Account, type ManagedAccount } from "@/src/infrastructure/api-client";

export function UsersView({ current, notify }: { current: Account; notify: (message: string, error?: boolean) => void }) {
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void apiClient.users().then((result) => setAccounts(result.users)).catch((error) => notify(error.message, true)).finally(() => setLoading(false)); }, [notify]);
  async function changeRole(account: ManagedAccount) {
    const role = account.role === "admin" ? "user" : "admin";
    try { await apiClient.setRole(account.id, role); setAccounts((previous) => previous.map((item) => item.id === account.id ? { ...item, role } : item)); notify("Rol actualizado."); }
    catch (error) { notify(error instanceof Error ? error.message : "No se pudo cambiar el rol.", true); }
  }
  return <><div className="page-heading"><div><span className="eyebrow">CONTROL DE ACCESO</span><h1>Usuarios</h1><p>Hay dos roles: administrador crea contenido y salas; usuario se une a las partidas.</p></div></div><div className="users-panel"><div className="users-panel-heading"><Users size={21} /><strong>Cuentas registradas</strong><span>{accounts.length}</span></div>{loading ? <p className="quiet">Cargando cuentas…</p> : accounts.map((account) => <div className="user-row" key={account.id}><span className="avatar">{account.name.slice(0, 1).toUpperCase()}</span><div><strong>{account.name}</strong><small>{account.email}</small></div><span className={`role-pill ${account.role}`}><ShieldCheck size={14} /> {account.role === "admin" ? "Administrador" : "Usuario"}</span><button className="secondary-button" onClick={() => void changeRole(account)} disabled={account.id === current.id}>{account.role === "admin" ? "Hacer usuario" : "Hacer administrador"}</button></div>)}</div></>;
}
