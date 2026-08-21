import type { OracleReading } from "../domain/model.ts";

/**
 * The API contract for the Oracle boundary — shared between the route
 * handler (src/app/api/oracle/route.ts) and any future client, so
 * neither has to guess the other's shape.
 */
export type OracleReadingsResponse = {
  asset: string;
  readings: OracleReading[];
};
