import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ItemForm } from "../components/ItemForm";
import { ApiError, itemsApi, type ItemWrite } from "../lib/api";

export function ItemCreatePage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: ItemWrite & { idNb: string; name: string }) => itemsApi.create(payload),
    onSuccess: (res) => navigate(`/items/${encodeURIComponent(res.item.idNb)}`),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Create failed."),
  });

  return (
    <div className="space-y-4">
      <div>
        <Link to="/items" className="text-sm text-amber-600 hover:underline">
          ← Items
        </Link>
        <h1 className="mt-1 text-xl font-semibold">New item template</h1>
      </div>
      <ItemForm
        mode="create"
        submitting={mutation.isPending}
        error={error}
        onSubmit={(payload) => {
          setError(null);
          if (!payload.idNb || !payload.name) {
            setError("Id_nb and Name are required.");
            return;
          }
          mutation.mutate(payload as ItemWrite & { idNb: string; name: string });
        }}
      />
    </div>
  );
}
