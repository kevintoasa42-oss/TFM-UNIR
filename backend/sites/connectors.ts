import { createConnectors } from "../../shared/sites/connector-contract.mjs";
import { getConnectorBinding } from "./connector-context";

/** Keep invocation context on this request; never cache it across visitors. */
export function connectorsForRequest() {
  return createConnectors(getConnectorBinding());
}
export type {
  ConnectorContext,
  ConnectorResult,
  ConnectorFailureStatus,
  Json,
} from "../../shared/sites/connector-contract.mjs";
