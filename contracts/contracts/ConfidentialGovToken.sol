// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ConfidentialGovToken
/// @author Conclave
/// @notice A confidential ERC-7984 token used both as the ballot treasury asset and as
///         the voting weight staked on a ballot.
/// @dev Minting is owner-only, as a real governance token's would be: on a production
///      deployment the owner is the DAO or its multisig, and the faucet below is not
///      deployed. For the testnet demo a public, one-claim-per-address faucet mints a
///      fixed amount so anyone can get voting weight without begging an admin.
contract ConfidentialGovToken is ERC7984, ZamaEthereumConfig, Ownable {
    /// @notice Amount the faucet mints per claim, in base units. decimals() is 6, so this
    ///         is 100 cGOV. Public and fixed on purpose: a faucet amount is not a secret.
    uint64 public constant FAUCET_AMOUNT = 100_000_000;

    /// @dev Whether an address has already claimed from the faucet.
    mapping(address account => bool claimed) private _faucetClaimed;

    error FaucetAlreadyClaimed();

    constructor(
        string memory name_,
        string memory symbol_,
        string memory contractURI_,
        address initialOwner
    ) ERC7984(name_, symbol_, contractURI_) Ownable(initialOwner) {}

    /// @notice Mint confidential tokens to `to`. Restricted to the owner, so the supply of
    ///         governance weight cannot be printed by anyone.
    /// @param to Recipient of the newly minted tokens.
    /// @param encryptedAmount Encrypted amount handle produced off-chain.
    /// @param inputProof Proof that the caller knows the plaintext behind `encryptedAmount`.
    /// @return The encrypted amount actually minted.
    function mint(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyOwner returns (euint64) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        return _mint(to, amount);
    }

    /// @notice Testnet faucet: mint a fixed FAUCET_AMOUNT to the caller, once per address,
    ///         so a demo user or a judge can get voting weight in one click. Reverts on a
    ///         second claim from the same address.
    /// @return The encrypted amount minted.
    function faucetMint() external returns (euint64) {
        if (_faucetClaimed[msg.sender]) revert FaucetAlreadyClaimed();
        _faucetClaimed[msg.sender] = true;
        euint64 amount = FHE.asEuint64(FAUCET_AMOUNT);
        return _mint(msg.sender, amount);
    }

    /// @notice Whether `account` has already claimed from the faucet.
    function faucetClaimed(address account) external view returns (bool) {
        return _faucetClaimed[account];
    }
}
