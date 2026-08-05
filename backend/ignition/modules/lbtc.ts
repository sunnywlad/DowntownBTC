import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LBTCModule", (m) => {
  const lbtc = m.contract("MockWrappedBTC", ["Lombard BTC", "LBTC"]);

  return { lbtc };
});
