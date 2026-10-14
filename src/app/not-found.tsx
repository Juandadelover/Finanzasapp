import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-4">
      <EmptyState
        icon={FileQuestion}
        title="Página no encontrada"
        description="La página que buscas no existe o se ha movido."
        action={{ label: "Ir a Inicio", href: "/" }}
      />
    </main>
  );
}
