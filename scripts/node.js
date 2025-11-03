// scripts/node.js
import hre from "hardhat";
import { simulateKyberKeypair, simulateEncapsulation, simulateDecapsulation } from "./utils.js";

const [nodeId, contractAddr] = process.argv.slice(2);

async function runNode() {
  const { ethers } = hre;
  const [signer] = await ethers.getSigners();
  const NodeScore = await ethers.getContractFactory("NodeScore");
  const contract = NodeScore.attach(contractAddr);

  const keypair = simulateKyberKeypair();
  console.log(`${nodeId}: Initialized simulated Kyber keys`, keypair);

  let state = {
    uptime: 80 + Math.random() * 20,
    latency: 40 + Math.random() * 40,
    accuracy: 70 + Math.random() * 30,
    missed: 0,
    epochsActive: 0,
  };

  const tick = () => {
    state.uptime = Math.max(0, Math.min(100, state.uptime + (Math.random() - 0.45) * 6));
    state.latency = Math.max(5, Math.min(400, state.latency + (Math.random() - 0.5) * 30));
    state.accuracy = Math.max(0, Math.min(100, state.accuracy + (Math.random() - 0.5) * 4));
    state.epochsActive++;
    if (Math.random() < 0.03) {
      state.accuracy -= 10 + Math.random() * 30;
      state.missed++;
    }
  };

  const computeScore = (s) => {
    const uptimeScore = s.uptime;
    const latencyScore = 100 - (Math.min(200, s.latency) / 200) * 100;
    const accuracyScore = s.accuracy;
    const score = 0.5 * uptimeScore + 0.3 * accuracyScore + 0.2 * latencyScore;
    return Math.max(0, Math.min(100, Math.floor(score)));
  };

  while (true) {
    tick();

    const { sharedSecret, ciphertext } = simulateEncapsulation(keypair.publicKey);
    const decapsulated = simulateDecapsulation(keypair.privateKey, ciphertext);
    const score = computeScore(state);

    const tx = await contract.updateScore(nodeId, score);
    await tx.wait();

    const safe = await contract.isSafe(nodeId);
    console.log(
      `${nodeId} | Score: ${score} | Safe: ${safe} | Secret: ${sharedSecret === decapsulated ? "✅" : "❌"}`
    );

    await new Promise((r) => setTimeout(r, 5000));
  }
}

runNode().catch(console.error);
