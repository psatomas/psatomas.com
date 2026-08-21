import { MonoLabel } from "@/components/ui/mono-label";

type Stat = { label: string; value: string };

const evmStats: Stat[] = [
  { label: "STATE MODEL", value: "Global State" },
  { label: "EXECUTION", value: "Stack-based VM" },
  { label: "RESOURCE MODEL", value: "Gas" },
  { label: "PARALLELISM", value: "Limited" },
];

const svmStats: Stat[] = [
  { label: "STATE MODEL", value: "Account Model" },
  { label: "EXECUTION", value: "Sealevel" },
  { label: "RESOURCE MODEL", value: "Compute Units" },
  { label: "PARALLELISM", value: "Explicit" },
];

function StatRow({ stat }: { stat: Stat }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-border py-3 first:border-t-0">
      <MonoLabel>{stat.label}</MonoLabel>
      <span className="text-sm text-foreground">{stat.value}</span>
    </div>
  );
}

function TxBox({
  children,
  emphasis = false,
}: {
  children: string;
  emphasis?: boolean;
}) {
  return (
    <span
      className={`whitespace-nowrap border px-2.5 py-1.5 font-mono text-[11px] tracking-[0.05em] ${
        emphasis
          ? "border-accent text-accent"
          : "border-border-strong text-muted"
      }`}
    >
      {children}
    </span>
  );
}

function Arrow() {
  return <span className="text-dim">→</span>;
}

export function EvmSvmExperiment() {
  return (
    <div className="p-6 sm:p-8">
      <MonoLabel className="text-dim">
        EXPERIMENT 01 — EVM × SVM EXECUTION MODELS
      </MonoLabel>

      <div className="mt-8 grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-0">
        {/* EVM column */}
        <div className="flex flex-col gap-6 sm:pr-10">
          <h3 className="font-mono text-sm tracking-[0.1em] text-foreground">
            EVM
          </h3>

          <div>
            {evmStats.map((stat) => (
              <StatRow key={stat.label} stat={stat} />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <MonoLabel>SEQUENTIAL EXECUTION</MonoLabel>
            <div className="flex flex-wrap items-center gap-2">
              <TxBox emphasis>TX 01</TxBox>
              <Arrow />
              <TxBox>STATE</TxBox>
              <Arrow />
              <TxBox emphasis>TX 02</TxBox>
              <Arrow />
              <TxBox>STATE</TxBox>
              <Arrow />
              <TxBox emphasis>TX 03</TxBox>
            </div>
            <p className="text-xs text-muted">
              Each transaction reads and mutates global state in order — the
              next transaction can&apos;t start until the previous one
              settles.
            </p>
          </div>
        </div>

        {/* SVM column */}
        <div className="flex flex-col gap-6 border-t border-border pt-10 sm:border-t-0 sm:border-l sm:pl-10 sm:pt-0">
          <h3 className="font-mono text-sm tracking-[0.1em] text-foreground">
            SVM
          </h3>

          <div>
            {svmStats.map((stat) => (
              <StatRow key={stat.label} stat={stat} />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <MonoLabel>PARALLEL EXECUTION</MonoLabel>
            <div className="flex items-stretch gap-0">
              <div className="flex flex-col gap-2">
                <TxBox emphasis>TX 01</TxBox>
                <TxBox emphasis>TX 02</TxBox>
                <TxBox emphasis>TX 03</TxBox>
              </div>
              <div className="w-4 border-y border-r border-border-strong" />
              <div className="flex items-center">
                <TxBox emphasis>EXECUTION</TxBox>
              </div>
            </div>
            <p className="text-xs text-muted">
              Transactions declare which accounts they touch up front, so
              non-overlapping transactions execute concurrently on Sealevel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
