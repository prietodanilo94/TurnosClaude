import { redirect } from "next/navigation";

export default function VendedorIndexPage() {
  const now = new Date();
  redirect(`/vendedor/${now.getFullYear()}/${now.getMonth() + 1}`);
}
