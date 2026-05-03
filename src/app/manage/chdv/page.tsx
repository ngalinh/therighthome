import { ManageTypePage } from "../manage-page";

export default async function ManageChdvPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; month?: string; year?: string; status?: string; building?: string; room?: string }>;
}) {
  const sp = await searchParams;
  return <ManageTypePage kind="CHDV" searchParams={sp} />;
}
