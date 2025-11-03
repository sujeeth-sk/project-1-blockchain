import hre from "hardhat";
import crypto from "crypto";

async function simulate() {
  const { ethers } = hre;
  const signers = await ethers.getSigners();
  const deployer = signers[0];

  // Deploy the contract
  const NodeScore = await ethers.getContractFactory("NodeScore");
  const contract = await NodeScore.deploy();
  await contract.waitForDeployment();

  console.log("Deployer:", deployer.address);
  console.log("Contract deployed at:", await contract.getAddress());

  // Pick 4 simulated nodes (real addresses)
  const nodes = signers.slice(1, 5);
  const nodeStates = {};

  // Initialize simulated Kyber keypairs (mocked)
  for (const node of nodes) {
    const publicKey = crypto.randomBytes(16).toString("hex");
    const privateKey = crypto.randomBytes(16).toString("hex");
    console.log(`${node.address}: Initialized simulated Kyber keys`, {
      publicKey,
      privateKey,
    });

    nodeStates[node.address] = {
      uptime: 80 + Math.random() * 20,
      latency: 40 + Math.random() * 40,
      accuracy: 70 + Math.random() * 30,
      missed: 0,
      epochsActive: 0,
    };
  }

  function tickState(s) {
    s.uptime = Math.max(0, Math.min(100, s.uptime + (Math.random() - 0.45) * 6));
    s.latency = Math.max(5, Math.min(400, s.latency + (Math.random() - 0.5) * 30));
    s.accuracy = Math.max(0, Math.min(100, s.accuracy + (Math.random() - 0.5) * 4));
    s.epochsActive += 1;
    if (Math.random() < 0.03) {
      s.accuracy = Math.max(0, s.accuracy - (10 + Math.random() * 30));
      s.missed += 1;
    }
  }

  function computeScore(s) {
    const uptimeScore = s.uptime;
    const latencyNormalized = Math.min(200, s.latency);
    const latencyScore = 100 - (latencyNormalized / 200) * 100;
    const accuracyScore = s.accuracy;
    const score = 0.5 * uptimeScore + 0.3 * accuracyScore + 0.2 * latencyScore;
    return Math.max(0, Math.min(100, Math.floor(score)));
  }

  while (true) {
    console.log("\n=== New Round ===");
    for (const node of nodes) {
      tickState(nodeStates[node.address]);
      const score = computeScore(nodeStates[node.address]);

      const tx = await contract.updateScore(node.address, score);
      await tx.wait();

      const safe = await contract.isSafe(node.address);
      const onchainScore = await contract.getScore(node.address);

      console.log(
        node.address,
        "score:",
        onchainScore.toString(),
        safe ? "SAFE" : "UNSAFE",
        "local:",
        score,
        "state:",
        nodeStates[node.address]
      );
    }

    const safeNodes = [];
    for (const node of nodes) {
      const safe = await contract.isSafe(node.address);
      if (safe) safeNodes.push(node.address);
    }

    if (safeNodes.length === 0) {
      console.log("No safe nodes this round. Skipping proposals.");
    } else {
      const chosen = safeNodes[Math.floor(Math.random() * safeNodes.length)];
      console.log("Chosen proposer:", chosen);
    }

    await new Promise((r) => setTimeout(r, 4000));
  }
}

simulate().catch((e) => {
  console.error(e);
  process.exit(1);
});
