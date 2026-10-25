import { notFound } from "next/navigation";
import { renderPortal, type PageProps } from "../../../lib/render-portal";
export const dynamic = "force-dynamic";
export default async function Page(
  props: PageProps & { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  if (!/^[a-f0-9]{64}$/.test(id)) notFound();
  return renderPortal("profile", props, id);
}
