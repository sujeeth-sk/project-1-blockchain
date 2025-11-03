// scripts/network-monitor.js
import fs from "fs/promises";
import path from "path";
import hre from "hardhat";
import { generateMockNodes } from "./utils.js";
import { kemGenerateKeys } from "../backend/crypto-lib.js";

const OUT_DIR = path.join(process.cwd(), "backend");
await fs.mkdir(OUT_DIR, { recursive: true });

// === Reputation Scoring Logic ===
function calculateReputationScore(metrics) {
  const uptimeScore = metrics.uptime;
  const latencyNormalized = Math.min(200, metrics.latency);
  const latencyScore = 100 - (latencyNormalized / 200) * 100;
  const accuracyScore = metrics.accuracy;
  const score = 0.5 * uptimeScore + 0.3 * accuracyScore + 0.2 * latencyScore;
  return Math.max(0, Math.min(100, Math.floor(score)));
}

// === Metrics Evolution ===
function updateMetrics(metrics) {
  metrics.uptime = Math.max(0, Math.min(100, metrics.uptime + (Math.random() - 0.45) * 6));
  metrics.latency = Math.max(5, Math.min(400, metrics.latency + (Math.random() - 0.5) * 30));
  metrics.accuracy = Math.max(0, Math.min(100, metrics.accuracy + (Math.random() - 0.5) * 4));
  metrics.epochsActive += 1;

  // Random penalty event
  if (Math.random() < 0.03) {
    metrics.accuracy = Math.max(0, metrics.accuracy - (10 + Math.random() * 30));
    metrics.missed += 1;
  }
}

// === Ensure at least 2 nodes always above threshold ===
function enforceHealthyNodes(nodes, nodeMetrics) {
  const scores = nodes.map((n) => ({
    id: n,
    score: calculateReputationScore(nodeMetrics[n]),
  }));

  const sorted = scores.sort((a, b) => b.score - a.score);
  const top2 = sorted.slice(0, 2);

  for (const { id } of top2) {
    nodeMetrics[id].uptime = 95 + Math.random() * 5;
    nodeMetrics[id].accuracy = 90 + Math.random() * 5;
    nodeMetrics[id].latency = 30 + Math.random() * 10;
  }
}

// === MAIN SCRIPT ===
async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying Reputation contract...");
  const Reputation = await hre.ethers.getContractFactory("Reputation", deployer);
  const reputationContract = await Reputation.deploy();
  await reputationContract.waitForDeployment();

  const contractAddr = await reputationContract.getAddress();
  console.log("Deployer:", deployer.address);
  console.log("Reputation contract deployed at:", contractAddr);

  await fs.writeFile(path.join(OUT_DIR, "contractAddress.txt"), contractAddr, "utf8");

  const nodeCount = 8;
  const nodes = generateMockNodes(nodeCount);
  console.log("Registered nodes:", nodes);

  const nodeMetrics = {};
  const nodeCryptoKeys = {};

  for (const n of nodes) {
    nodeMetrics[n] = {
      uptime: 80 + Math.random() * 20,
      latency: 40 + Math.random() * 40,
      accuracy: 70 + Math.random() * 30,
      missed: 0,
      epochsActive: 0,
    };
    nodeCryptoKeys[n] = kemGenerateKeys();
  }

  const nodesJson = nodes.map((addr) => ({
    address: addr,
    publicKey: nodeCryptoKeys[addr].publicKey,
    secretKey: nodeCryptoKeys[addr].secretKey, // for demo only
  }));

  await fs.writeFile(path.join(OUT_DIR, "nodes.json"), JSON.stringify(nodesJson, null, 2), "utf8");
  console.log(" Wrote backend/nodes.json with node addresses and PQC keys.");

  // === Reputation Update Loop ===
  while (true) {
    console.log("\n=== New Network Round ===");

    // Update metrics and ensure 2 healthy nodes
    for (const n of nodes) updateMetrics(nodeMetrics[n]);
    enforceHealthyNodes(nodes, nodeMetrics);

    for (const n of nodes) {
      const score = calculateReputationScore(nodeMetrics[n]);
      try {
        const tx = await reputationContract.updateScore(n, score);
        if (tx && tx.wait) await tx.wait();
      } catch (e) {
        console.error("updateScore failed:", e.message);
      }

      const onchainScore = await reputationContract.getScore(n);
      const safe = await reputationContract.isSafe(n);
      console.log(`${n} → score: ${onchainScore.toString()} (${safe ? "SAFE" : "UNSAFE"}), local: ${score}`);
    }

    const snapshot = {};
    for (const n of nodes) snapshot[n] = Number((await reputationContract.getScore(n)).toString());
    await fs.writeFile(path.join(OUT_DIR, "scores.json"), JSON.stringify(snapshot, null, 2), "utf8");

    await new Promise((r) => setTimeout(r, 4000));
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
