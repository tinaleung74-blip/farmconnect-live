import { Suspense } from "react";
import { FarmRequests } from "@/lib/farmconnect-v1";
export default function CustomerFarmRequestsPage() {
  return <Suspense fallback={null}><FarmRequests /></Suspense>;
}
