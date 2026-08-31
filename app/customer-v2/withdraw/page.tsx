import { redirect } from "next/navigation";

export default function CustomerWithdrawalRedirect() {
  redirect("/customer-v2/wallet");
}
