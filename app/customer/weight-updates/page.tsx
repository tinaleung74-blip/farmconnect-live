import { Suspense } from "react";
import { FarmRequests } from "@/lib/farmconnect-v1";
export default function CustomerWeightUpdatesPage() {
  return <Suspense fallback={null}><FarmRequests /></Suspense>;
}
