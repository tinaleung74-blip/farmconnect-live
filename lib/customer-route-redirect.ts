import { redirect } from "next/navigation";

type Query = Record<string, string | string[] | undefined>;

// Compatibility URLs only: old customer pages never render the retired UI.
export function customerRouteRedirect(destination: string) {
  return async function CustomerRedirect({ searchParams }: { searchParams: Promise<Query> }) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
      if (Array.isArray(value)) value.forEach(item => query.append(key, item));
      else if (value !== undefined) query.set(key, value);
    }
    const suffix = query.toString();
    redirect(`/customer-v2/${destination}${suffix ? `?${suffix}` : ""}`);
  };
}
