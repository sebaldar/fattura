"use client";

import { useRouter } from "next/navigation";
import { ClienteForm } from "../../../../components/ClienteForm";
import { createCliente } from "../../../../lib/clienti";

export default function NuovoClientePage() {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Nuovo cliente</h1>
      <ClienteForm
        showPhotoUpload
        submitLabel="Crea cliente"
        onSubmit={async (input) => {
          const cliente = await createCliente(input);
          router.push(`/clienti/${cliente.id}`);
        }}
      />
    </div>
  );
}
