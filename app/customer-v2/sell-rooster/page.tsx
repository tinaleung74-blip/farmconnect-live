import { Suspense } from "react";
import { CustomerSellRooster } from "@/lib/farmconnect-v1";

export default function CustomerV2SellRoosterPage() {
  return <Suspense fallback={null}><CustomerSellRooster /></Suspense>;
}
