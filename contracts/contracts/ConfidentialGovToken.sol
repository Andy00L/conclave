// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";

/// @title ConfidentialGovToken
/// @author Conclave
/// @notice A confidential ERC-7984 token used as the ballot treasury asset.
/// @dev Minting is intentionally open so a demo treasury can be funded on a testnet.
///      On a real deployment mint access would be restricted; here it acts as a faucet.
contract ConfidentialGovToken is ERC7984, ZamaEthereumConfig {
    constructor(
        string memory name_,
        string memory symbol_,
        string memory contractURI_
    ) ERC7984(name_, symbol_, contractURI_) {}

    /// @notice Mint confidential tokens to `to`.
    /// @param to Recipient of the newly minted tokens.
    /// @param encryptedAmount Encrypted amount handle produced off-chain.
    /// @param inputProof Proof that the caller knows the plaintext behind `encryptedAmount`.
    /// @return The encrypted amount actually minted.
    function mint(address to, externalEuint64 encryptedAmount, bytes calldata inputProof) external returns (euint64) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        return _mint(to, amount);
    }
}
