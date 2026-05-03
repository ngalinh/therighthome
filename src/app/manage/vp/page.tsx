import { ManageTypePage } from "../manage-page";

export default async function ManageVpPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; month?: string; year?: string; status?: string; building?: string; room?: string }>;
}) {
  const sp = await searchParams;
  return <ManageTypePage kind="VP" searchParams={sp} />;
}
