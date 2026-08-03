import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("cbBTCModule", (m) => {
  const cbbtc = m.contract("MockWrappedBTC", ["Coinbase BTC", "cbBTC"]);

  return { cbbtc };
});
