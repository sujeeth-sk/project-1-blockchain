// backend/api.js
import express from "express";
import fs from "fs/promises";
import path from "path";
import cors from "cors";
import multer from "multer";
import { fileURLToPath } from "url";
import { create } from "ipfs-http-client";

// Import PQC and AES functions from the crypto library
import {
  kemEncapsulate,
  deriveAesKey,
  aesEncrypt
} from "./crypto-lib.js";

// Connect to the local IPFS daemon
const ipfs = create({ host: "127.0.0.1", port: 5001, protocol: "http" });
console.log("Connected to local IPFS daemon");

// Dynamically import Hardhat Runtime Environment
import("hardhat").then((hre) => startServer(hre));

async function startServer(hre) {
    const { ethers } = hre;

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const app = express();
    app.use(cors());
    app.use(express.json());

    // Use memoryStorage for multer to handle file buffer directly
    const upload = multer({ storage: multer.memoryStorage() });

    const CONTRACT_ADDR_PATH = path.join(__dirname, "contractAddress.txt");
    const NODES_JSON = path.join(__dirname, "nodes.json");

    async function safeReadJSON(file, fallback = []) {
        try {
            const txt = await fs.readFile(file, "utf8");
            return JSON.parse(txt);
        } catch {
            return fallback;
        }
    }

    // Get deployed contract
    async function getContract() {
        try {
            const raw = JSON.parse(
                await fs.readFile(
                    path.join(process.cwd(), "artifacts/contracts/Reputation.sol/Reputation.json"),
                    "utf8"
                )
            );

            const contractAddr = (await fs.readFile(CONTRACT_ADDR_PATH, "utf8")).trim();
            
            let provider, signer;
            try {
                const { JsonRpcProvider } = (await import("ethers")).default ?? (await import("ethers"));
                provider = new JsonRpcProvider("http://127.0.0.1:8545");
                signer = await provider.getSigner(0);
            } catch (err) {
                const ethers = (await import("ethers")).ethers || (await import("ethers"));
                provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
                const accounts = await provider.listAccounts();
                signer = provider.getSigner(accounts[0]);
            }
            return new (await import("ethers")).ethers.Contract(contractAddr, raw.abi, signer);
        } catch (err) {
            console.warn("Could not load smart contract");
            return null;
        }
    }

    // Endpoint to get all registered nodes and their on-chain scores
    app.get("/nodes", async (req, res) => {
        try {
            const nodes = await safeReadJSON(NODES_JSON, []);
            const contract = await getContract();
            const results = [];

            if (!contract) {
                 return res.status(500).json({ error: "Smart contract not available" });
            }

            for (const node of nodes) {
                try {
                    const score = await contract.getScore(node.address);
                    const isSafe = await contract.isSafe(node.address);
                    results.push({
                        address: node.address,
                        publicKey: node.publicKey, // Provide public key
                        score: Number(score.toString()),
                        safe: isSafe
                    });
                } catch (err) {
                    results.push({
                        address: node.address,
                        publicKey: node.publicKey,
                        score: 0,
                        safe: false
                    });
                }
            }
            res.json(results);
        } catch (err) {
            console.error("❌ Error fetching nodes:", err);
            res.status(500).json({ error: err.message });
        }
    });

    // Handle direct file upload to IPFS
    app.post("/upload", upload.single("file"), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "No file uploaded." });
            }
            
            // --- IPFS UPLOAD (Unencrypted) ---
            // Wrap file buffer and filename in a JSON object for storage
            const fileData = {
                filename: req.file.originalname,
                // Use Buffer.toJSON() for binary-safe JSON serialization
                content: req.file.buffer.toJSON()
            };
            
            const { cid } = await ipfs.add(JSON.stringify(fileData));
            const ipfsCid = cid.toString();
            console.log(`File added to IPFS with CID: ${ipfsCid}`);

            // --- PQC/AES ENCRYPTION DEMO (In Parallel) ---
            // This part is just to generate the "alert" values for the frontend.
            // It is not used to store the file.
            let kyberDemoData = { error: "No safe nodes found to encrypt for." };
            const allNodes = await safeReadJSON(NODES_JSON, []);
            const contract = await getContract();
            
            let targetNode = null;
            if (contract) {
                 for (const node of allNodes) {
                    if (await contract.isSafe(node.address)) {
                        targetNode = node;
                        break;
                    }
                 }
            }

            if (targetNode) {
                console.log(`Running PQC demo for node: ${targetNode.address}`);
                // 1. PQC: Encapsulate a secret
                const { ciphertext: kemCt, sharedSecret } = kemEncapsulate(targetNode.publicKey);
                // 2. Derive AES key
                const aesKey = deriveAesKey(sharedSecret);
                // 3. AES: Encrypt the file buffer
                const { ciphertext, iv, tag } = aesEncrypt(aesKey, req.file.buffer);

                kyberDemoData = {
                    encryptedForNode: targetNode.address,
                    kemCt: kemCt,
                    aesKey_DEMO_ONLY: aesKey.toString('hex'), // For display
                    sharedSecret_DEMO_ONLY: sharedSecret // For display
                };
            }

            // Return both the IPFS CID and the demo crypto data
            res.json({ 
                ok: true, 
                cid: ipfsCid,
                kyberDemo: kyberDemoData
            });

        } catch (err) {
            console.error("Upload failed:", err);
            res.status(500).json({ error: err.message });
        }
    });

    // Handle direct file download from IPFS (file is unencrypted)
    app.get("/download/:cid", async (req, res) => {
        try {
            const cid = req.params.cid;
            if (!cid) {
                return res.status(400).json({ error: "No CID provided." });
            }

            // Retrieve the JSON-wrapped file from IPFS
            const chunks = [];
            for await (const chunk of ipfs.cat(cid)) {
                chunks.push(chunk);
            }
            const ipfsBuffer = Buffer.concat(chunks);
            const ipfsPayload = JSON.parse(ipfsBuffer.toString());

            // Reconstruct the file buffer from the JSON object
            const fileBuffer = Buffer.from(ipfsPayload.content.data);
            const filename = ipfsPayload.filename || "downloaded_file";
            
            console.log(`✅ Sending file: ${filename}`);
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            res.send(fileBuffer);

        } catch (err) {
            console.error("Download failed:", err);
            res.status(500).json({ error: err.message });
        }
    });

    // Start backend
    const PORT = 5000;
    app.listen(PORT, () =>
        console.log(`Backend server running at http://localhost:${PORT}`)
    );
}