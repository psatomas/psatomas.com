import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

const projects = [
  {
    name: "Execution Kernel Protocol",
    description: "A lean execution layer kernel for EVM-compatible chains.",
  },
  {
    name: "Protocol Engineering Lab",
    description: "Experiments and reference implementations in protocol design.",
  },
  {
    name: "Web3 Status Registry",
    description: "On-chain registry for tracking protocol and node status.",
  },
  {
    name: "StakeVerse Protocol",
    description: "A staking protocol focused on validator infrastructure.",
  },
  {
    name: "ProofChain",
    description: "Verification and proof infrastructure for smart contracts.",
  },
];

export default function Home() {
  return (
    <Container as="main" className="flex flex-1 flex-col gap-20 py-16">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Tomás Araújo — Protocol Engineer |{" "}
          <span className="text-accent">EVM &amp; SVM</span>
        </h1>
        <p className="max-w-xl text-lg text-muted">
          I build protocol infrastructure and smart contracts across the EVM
          and SVM ecosystems — blockchain, Web3, and the systems that hold
          them together.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>About</SectionHeading>
        <p className="max-w-xl text-zinc-700 dark:text-zinc-300">
          My work centers on protocol engineering: Solidity and EVM internals,
          smart contract systems, and the infrastructure that keeps
          decentralized protocols reliable. I write about what I build and
          learn along the way.
        </p>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeading>Featured Work</SectionHeading>
        <ul className="flex flex-col gap-6">
          {projects.map((project) => (
            <li key={project.name} className="flex flex-col gap-1">
              <span className="font-medium">{project.name}</span>
              <span className="text-muted">{project.description}</span>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
