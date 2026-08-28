import { Suspense } from "react";
import { FarmRequests } from "@/lib/farmconnect-v1";

export default function CustomerCareV2Page() {
  return <Suspense fallback={null}><FarmRequests /></Suspense>;
}
