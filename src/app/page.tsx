import BinnieApp from "./app";
import { getWorkspaceSnapshot } from "@/data/tasks";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialSnapshot = await getWorkspaceSnapshot();
  return <BinnieApp initialSnapshot={initialSnapshot ?? undefined} />;
}
