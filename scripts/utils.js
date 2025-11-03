// scripts/utils.js
import hre from "hardhat";

export function generateMockNodes(count = 8) {
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const w = hre.ethers.Wallet.createRandom();
    nodes.push(w.address);
  }
  return nodes;
}