import { Hero } from "@/components/sections/hero";
import { ProtocolLab } from "@/components/sections/protocol-lab";

export default function Home() {
  return (
    <main className="flex-1">
      <Hero />
      <ProtocolLab />
    </main>
  );
}
