import { Header } from "@/components/Header";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <Dashboard />
      </main>
    </>
  );
}
