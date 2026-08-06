import { Suspense } from "react";
import { CustomerSellRooster } from "@/lib/farmconnect-v1";

export default function Page() {
  return <Suspense fallback={null}><CustomerSellRooster /></Suspense>;
}
