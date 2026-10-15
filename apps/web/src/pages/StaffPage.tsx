import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { staffApi, type StaffUser } from "../lib/api";

export function StaffPage() {
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["staff"], queryFn: () => staffApi.list() });
  const items = data?.items ?? [];
  const refetch = () => qc.invalidateQueries({ queryKey: ["staff"] });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Staff</h1>

      <CreateStaff onCreated={refetch} />

      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Active</th>
              <th className="px-4 py-2 font-medium">Last login</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <StaffRow key={u.id} user={u} onChanged={refetch} />
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No staff users.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StaffRow({ user, onChanged }: { user: StaffUser; onChanged: () => void }) {
  const { user: me } = useAuth();
  const isSelf = me?.id === user.id;

  const mutation = useMutation({
    mutationFn: (updates: { role?: "admin" | "gm"; isActive?: boolean }) =>
      staffApi.update(user.id, updates),
    onSuccess: onChanged,
  });

  return (
    <tr className="border-t border-slate-100 dark:border-slate-800">
      <td className="px-4 py-2">
        {user.email} {isSelf && <span className="text-xs text-slate-400">(you)</span>}
      </td>
      <td className="px-4 py-2">
        <select
          value={user.role}
          disabled={isSelf || mutation.isPending}
          onChange={(e) => mutation.mutate({ role: e.target.value as "admin" | "gm" })}
          className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="gm">GM</option>
          <option value="admin">Admin</option>
        </select>
      </td>
      <td className="px-4 py-2">
        {user.isActive ? (
          <span className="text-emerald-600">Active</span>
        ) : (
          <span className="text-slate-400">Disabled</span>
        )}
      </td>
      <td className="px-4 py-2 text-slate-500">{user.lastLoginAt ?? "—"}</td>
      <td className="px-4 py-2 text-right">
        <button
          onClick={() => mutation.mutate({ isActive: !user.isActive })}
          disabled={isSelf || mutation.isPending}
          className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {user.isActive ? "Deactivate" : "Activate"}
        </button>
      </td>
    </tr>
  );
}

function CreateStaff({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "gm">("gm");
  const [msg, setMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => staffApi.create(email, password, role),
    onSuccess: () => {
      setMsg("Staff user created.");
      setEmail("");
      setPassword("");
      onCreated();
    },
    onError: (e) => setMsg((e as Error).message),
  });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 font-semibold">Add staff user</h2>
      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className="rounded-md border border-slate-300 px-2 py-2 dark:border-slate-700 dark:bg-slate-800"
        />
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 8)"
          className="rounded-md border border-slate-300 px-2 py-2 dark:border-slate-700 dark:bg-slate-800"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "gm")}
          className="rounded-md border border-slate-300 px-2 py-2 dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="gm">GM</option>
          <option value="admin">Admin</option>
        </select>
        <button
          onClick={() => {
            setMsg(null);
            mutation.mutate();
          }}
          disabled={mutation.isPending || !email || password.length < 8}
          className="rounded-md bg-amber-500 px-4 py-2 font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-60"
        >
          {mutation.isPending ? "Adding…" : "Add"}
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-slate-500">{msg}</p>}
    </section>
  );
}
