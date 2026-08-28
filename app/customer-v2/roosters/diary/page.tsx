import { Suspense } from "react";
import { CustomerRoosterDiaryV2 } from "@/lib/farmconnect-v1";

export default function CustomerRoosterDiaryV2Page() {
  return <Suspense fallback={null}><CustomerRoosterDiaryV2 /></Suspense>;
}
