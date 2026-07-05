import { Header } from "@/components/Header";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-[68rem] flex-1 px-6 pt-14 pb-18">
        <Dashboard />
      </main>
    </>
  );
}
