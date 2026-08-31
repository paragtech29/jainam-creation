import Link from "next/link";
import { ParticularForm } from "../particular-form";

export default function NewParticularPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Link href="/masters/particulars" className="text-sm text-muted-foreground">
        ← Back to particulars
      </Link>
      <h1 className="text-lg font-semibold">Add particular</h1>
      <ParticularForm />
    </div>
  );
}
