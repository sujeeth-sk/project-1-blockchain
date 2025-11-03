// contracts/NodeScore.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Reputation {
    address public admin;

    struct NodeData {
        uint256 score;
        bool isBlacklisted;
    }
    mapping(address => NodeData) public nodes;
    event ScoreUpdated(address indexed node, uint256 score);
    event NodeBlacklisted(address indexed node, bool status);

    struct FileMeta {
        string cid; 
        string filename;
        address uploader;
        uint256 timestamp;
    }
    mapping(address => FileMeta) public fileMeta;
    event FileStored(address indexed node, string cid, string filename, address uploader);

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not authorized");
        _;
    }

    function updateScore(address node, uint256 score) external onlyAdmin {
        require(score <= 100, "Invalid score");
        nodes[node].score = score;
        emit ScoreUpdated(node, score);
    }

    function setBlacklist(address node, bool status) external onlyAdmin {
        nodes[node].isBlacklisted = status;
        emit NodeBlacklisted(node, status);
    }

    function isSafe(address node) external view returns (bool) {
        return nodes[node].score >= 70 && !nodes[node].isBlacklisted;
    }

    function getScore(address node) external view returns (uint256) {
        return nodes[node].score;
    }

    function storeFileMeta(address node, string calldata cid, string calldata filename, address uploader) external onlyAdmin {
        fileMeta[node] = FileMeta({ cid: cid, filename: filename, uploader: uploader, timestamp: block.timestamp });
        emit FileStored(node, cid, filename, uploader);
    }

    function getFileMeta(address node) external view returns (string memory cid, string memory filename, address uploader, uint256 timestamp) {
        FileMeta storage m = fileMeta[node];
        return (m.cid, m.filename, m.uploader, m.timestamp);
    }
}

