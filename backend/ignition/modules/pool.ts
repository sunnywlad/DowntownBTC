import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import WBTCModule from "./wbtc";
import CBBTCModule from "./cbbtc";
import LBTCModule from "./lbtc";


export default buildModule("PoolModule", (m) => {
  const tokens = [m.useModule(WBTCModule).wbtc, m.useModule(CBBTCModule).cbbtc, m.useModule(LBTCModule).lbtc];

  const pool = m.contract("Pool", [tokens, 5, m.getAccount(0)]);

  return { pool };
});
