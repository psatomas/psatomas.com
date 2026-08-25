import { MonoLabel } from "@/components/ui/mono-label";
import { FlowBox, FlowArrow } from "@/components/lab/flow";

type Stat = { label: string; value: string };

const stateStats: Stat[] = [
  { label: "STATE MODEL", value: "Global State" },
  { label: "STORAGE", value: "Contract Storage" },
  { label: "RESOURCE MODEL", value: "Gas" },
];

const executionStats: Stat[] = [
  { label: "EXECUTION", value: "Stack-based VM" },
  { label: "CALL MODEL", value: "Message Calls" },
  { label: "ATOMICITY", value: "Transaction-level" },
];

function StatRow({ stat }: { stat: Stat }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-border py-3 first:border-t-0">
      <MonoLabel>{stat.label}</MonoLabel>
      <span className="text-sm text-foreground">{stat.value}</span>
    </div>
  );
}

export function EvmExperiment() {
  return (
    <div className="p-6 sm:p-8">
      <MonoLabel className="text-dim">EXPERIMENT 01 — EVM EXECUTION MODEL</MonoLabel>

      <div className="mt-8 grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-0">
        {/* State & storage */}
        <div className="flex flex-col gap-6 sm:pr-10">
          <h3 className="font-mono text-sm tracking-[0.1em] text-foreground">
            STATE &amp; STORAGE
          </h3>

          <div>
            {stateStats.map((stat) => (
              <StatRow key={stat.label} stat={stat} />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <MonoLabel>SEQUENTIAL WRITES</MonoLabel>
            <div className="flex flex-wrap items-center gap-2">
              <FlowBox emphasis>TX 01</FlowBox>
              <FlowArrow />
              <FlowBox>STATE</FlowBox>
              <FlowArrow />
              <FlowBox emphasis>TX 02</FlowBox>
              <FlowArrow />
              <FlowBox>STATE</FlowBox>
              <FlowArrow />
              <FlowBox emphasis>TX 03</FlowBox>
            </div>
            <p className="text-xs text-muted">
              Every transaction reads and mutates one global state in order —
              the next transaction can&apos;t start until the previous one
              settles.
            </p>
          </div>
        </div>

        {/* Execution & calls */}
        <div className="flex flex-col gap-6 border-t border-border pt-10 sm:border-t-0 sm:border-l sm:pl-10 sm:pt-0">
          <h3 className="font-mono text-sm tracking-[0.1em] text-foreground">
            EXECUTION &amp; CALLS
          </h3>

          <div>
            {executionStats.map((stat) => (
              <StatRow key={stat.label} stat={stat} />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <MonoLabel>MESSAGE CALL CHAIN</MonoLabel>
            <div className="flex flex-wrap items-center gap-2">
              <FlowBox>EOA</FlowBox>
              <FlowArrow />
              <FlowBox emphasis>CONTRACT A</FlowBox>
              <FlowArrow />
              <FlowBox emphasis>CONTRACT B</FlowBox>
              <FlowArrow />
              <FlowBox emphasis>CONTRACT C</FlowBox>
            </div>
            <p className="text-xs text-muted">
              A call chain either fully succeeds or the whole transaction
              reverts — there&apos;s no partial commit partway through a call
              stack.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
