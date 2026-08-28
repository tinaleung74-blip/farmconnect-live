import { redirect } from "next/navigation";

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  const params = await searchParams;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  redirect(id ? `/customer-v2/sell-rooster?id=${encodeURIComponent(id)}` : "/customer-v2/roosters");
}
