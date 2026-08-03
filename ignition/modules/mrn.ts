import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MRNModule", (m) => {
  const mrn = m.contract("MRN");

  return { mrn };
});
