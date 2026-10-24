import { renderPortal, type PageProps } from "../../lib/render-portal";
export const dynamic = "force-dynamic";
export default function Page(props: PageProps) {
  return renderPortal("reports", props);
}
