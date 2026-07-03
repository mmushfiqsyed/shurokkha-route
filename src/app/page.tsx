import Sidebar from "@/components/Sidebar";
import MapCanvasClient from "@/components/MapCanvasClient";

export default function DashboardPage() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex flex-1 flex-col">
        <MapCanvasClient />
      </main>
    </div>
  );
}
