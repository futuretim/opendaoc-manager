import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ItemForm } from "../components/ItemForm";
import { ApiError, itemsApi, type ItemWrite } from "../lib/api";

export function ItemEditPage() {
  const { idNb = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ["item", idNb],
    queryFn: () => itemsApi.get(idNb),
  });

  const mutation = useMutation({
    mutationFn: (updates: ItemWrite) => itemsApi.update(idNb, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["item", idNb] });
      navigate(`/items/${encodeURIComponent(idNb)}`);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Save failed."),
  });

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (loadError) return <p className="text-sm text-red-600">{(loadError as Error).message}</p>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div>
        <Link to={`/items/${encodeURIComponent(idNb)}`} className="text-sm text-amber-600 hover:underline">
          ← {data.item.name || idNb}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Edit item</h1>
        <p className="font-mono text-xs text-slate-500">{idNb}</p>
      </div>
      <ItemForm
        mode="edit"
        initial={data.item}
        submitting={mutation.isPending}
        error={error}
        onSubmit={(payload) => {
          setError(null);
          const { idNb: _ignore, ...updates } = payload;
          if (Object.keys(updates).length === 0) {
            navigate(`/items/${encodeURIComponent(idNb)}`);
            return;
          }
          mutation.mutate(updates as ItemWrite);
        }}
      />
    </div>
  );
}
