declare module "virtual:sites-connector-preview" {
  const binding: import("../../shared/sites/connector-contract.mjs").ConnectorBinding;
  export default binding;
}

// Only the local preview uses an environment binding. Hosted Sites receive the
// request-scoped capability through ctx.props.CONNECTORS in sites-worker.ts.
declare namespace Cloudflare {
  interface Env {
    CONNECTORS?: import("../../shared/sites/connector-contract.mjs").ConnectorBinding;
  }
}
