// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, ebool, euint64, externalEbool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

/// @title ConfidentialBallot
/// @author Conclave
/// @notice Governance ballots whose individual votes stay encrypted end to end,
///         wired to a confidential treasury: a passing ballot pays its beneficiary
///         an encrypted amount, so neither the votes nor the payout are ever public.
/// @dev A vote adds an encrypted 1 to exactly one of two tallies via FHE.select, so no
///      running count leaks and no observer can tell how an address voted. At close the
///      tallies are made publicly decryptable; resolve() brings the cleartext result
///      back on-chain, verified with FHE.checkSignatures. If the ballot passed,
///      execute() moves the encrypted payout from this contract's treasury balance.
contract ConfidentialBallot is ZamaEthereumConfig {
    /// @notice Lifecycle of a ballot.
    enum BallotState {
        Active, // accepting votes
        Revealing, // voting closed, tallies exposed for public decryption
        Resolved // cleartext result verified and stored
    }

    struct Ballot {
        string description;
        address beneficiary;
        uint64 startTime;
        uint64 endTime;
        euint64 encryptedYes;
        euint64 encryptedNo;
        euint64 payoutAmount;
        BallotState state;
        uint64 yesVotes; // populated at resolve()
        uint64 noVotes; // populated at resolve()
        bool passed; // populated at resolve()
        bool executed; // set once the payout has been sent
    }

    /// @notice The confidential token paid out of this contract's treasury on a pass.
    IERC7984 public immutable payoutToken;

    /// @dev All ballots, indexed by their position in this array (the ballot id).
    Ballot[] private _ballots;

    /// @dev ballot id => voter => whether that voter already voted.
    mapping(uint256 ballotId => mapping(address voter => bool voted)) private _hasVoted;

    event BallotCreated(uint256 indexed ballotId, string description, address indexed beneficiary, uint64 endTime);
    event VoteCast(uint256 indexed ballotId, address indexed voter);
    event BallotClosed(uint256 indexed ballotId);
    event BallotResolved(uint256 indexed ballotId, uint64 yesVotes, uint64 noVotes, bool passed);
    event PayoutExecuted(uint256 indexed ballotId, address indexed beneficiary);

    error InvalidDuration();
    error InvalidBeneficiary();
    error UnknownBallot(uint256 ballotId);
    error BallotNotActive(uint256 ballotId);
    error VotingPeriodOver(uint256 ballotId);
    error VotingPeriodNotOver(uint256 ballotId);
    error AlreadyVoted(uint256 ballotId);
    error BallotNotRevealing(uint256 ballotId);
    error BallotNotResolved(uint256 ballotId);
    error BallotNotPassed(uint256 ballotId);
    error PayoutAlreadyExecuted(uint256 ballotId);

    /// @param payoutToken_ The confidential ERC-7984 token held and paid out by this contract.
    constructor(IERC7984 payoutToken_) {
        payoutToken = payoutToken_;
    }

    /// @notice Create a ballot that, if it passes, pays `beneficiary` an encrypted amount.
    /// @param description Human readable question shown to voters.
    /// @param durationSeconds How long voting stays open, in seconds.
    /// @param beneficiary Address paid the confidential amount if the ballot passes.
    /// @param payoutAmount Encrypted payout handle produced off-chain by the creator.
    /// @param inputProof Proof that the creator knows the plaintext behind `payoutAmount`.
    /// @return ballotId The id of the newly created ballot.
    function createBallot(
        string calldata description,
        uint64 durationSeconds,
        address beneficiary,
        externalEuint64 payoutAmount,
        bytes calldata inputProof
    ) external returns (uint256 ballotId) {
        if (durationSeconds == 0) revert InvalidDuration();
        if (beneficiary == address(0)) revert InvalidBeneficiary();

        ballotId = _ballots.length;
        uint64 endTime = uint64(block.timestamp) + durationSeconds;

        euint64 initialYes = FHE.asEuint64(0);
        euint64 initialNo = FHE.asEuint64(0);
        euint64 amount = FHE.fromExternal(payoutAmount, inputProof);

        _ballots.push(
            Ballot({
                description: description,
                beneficiary: beneficiary,
                startTime: uint64(block.timestamp),
                endTime: endTime,
                encryptedYes: initialYes,
                encryptedNo: initialNo,
                payoutAmount: amount,
                state: BallotState.Active,
                yesVotes: 0,
                noVotes: 0,
                passed: false,
                executed: false
            })
        );

        // Keep both tallies usable by this contract for later adds and public decryption.
        FHE.allowThis(initialYes);
        FHE.allowThis(initialNo);
        // The payout must stay usable by this contract (to move it) and by the token
        // (to compute the transfer) when execute() runs in a later transaction.
        FHE.allowThis(amount);
        FHE.allow(amount, address(payoutToken));

        emit BallotCreated(ballotId, description, beneficiary, endTime);
    }

    /// @notice Cast one encrypted yes/no vote. `support` true adds to yes, false to no.
    ///         One vote per address.
    function vote(uint256 ballotId, externalEbool support, bytes calldata inputProof) external {
        Ballot storage ballot = _getBallot(ballotId);
        if (ballot.state != BallotState.Active) revert BallotNotActive(ballotId);
        if (block.timestamp > ballot.endTime) revert VotingPeriodOver(ballotId);
        if (_hasVoted[ballotId][msg.sender]) revert AlreadyVoted(ballotId);

        _hasVoted[ballotId][msg.sender] = true;

        ebool choice = FHE.fromExternal(support, inputProof);
        euint64 one = FHE.asEuint64(1);
        euint64 zero = FHE.asEuint64(0);

        // Add 1 to exactly one tally, without revealing which one.
        ballot.encryptedYes = FHE.add(ballot.encryptedYes, FHE.select(choice, one, zero));
        ballot.encryptedNo = FHE.add(ballot.encryptedNo, FHE.select(choice, zero, one));

        FHE.allowThis(ballot.encryptedYes);
        FHE.allowThis(ballot.encryptedNo);

        emit VoteCast(ballotId, msg.sender);
    }

    /// @notice Close voting once the period is over and expose both tallies for public
    ///         decryption. Anyone may call this after `endTime`.
    function closeBallot(uint256 ballotId) external {
        Ballot storage ballot = _getBallot(ballotId);
        if (ballot.state != BallotState.Active) revert BallotNotActive(ballotId);
        if (block.timestamp <= ballot.endTime) revert VotingPeriodNotOver(ballotId);

        FHE.makePubliclyDecryptable(ballot.encryptedYes);
        FHE.makePubliclyDecryptable(ballot.encryptedNo);
        ballot.state = BallotState.Revealing;

        emit BallotClosed(ballotId);
    }

    /// @notice Bring the decrypted tallies back on-chain. `cleartexts` and
    ///         `decryptionProof` come from the off-chain public decryption of the two
    ///         tally handles. checkSignatures reverts unless the KMS signed exactly
    ///         these handles, so the stored result cannot be forged.
    function resolve(uint256 ballotId, bytes calldata cleartexts, bytes calldata decryptionProof) external {
        Ballot storage ballot = _getBallot(ballotId);
        if (ballot.state != BallotState.Revealing) revert BallotNotRevealing(ballotId);

        bytes32[] memory handles = new bytes32[](2);
        handles[0] = FHE.toBytes32(ballot.encryptedYes);
        handles[1] = FHE.toBytes32(ballot.encryptedNo);
        FHE.checkSignatures(handles, cleartexts, decryptionProof);

        (uint64 yesVotes, uint64 noVotes) = abi.decode(cleartexts, (uint64, uint64));
        ballot.yesVotes = yesVotes;
        ballot.noVotes = noVotes;
        ballot.passed = yesVotes > noVotes;
        ballot.state = BallotState.Resolved;

        emit BallotResolved(ballotId, yesVotes, noVotes, ballot.passed);
    }

    /// @notice Pay the beneficiary the encrypted payout if the ballot passed. The amount
    ///         stays confidential; only the fact that a payout happened becomes public.
    /// @dev The treasury (this contract's ERC-7984 balance) must be funded beforehand.
    ///      If it holds less than the payout, ERC-7984 transfers what is available.
    function execute(uint256 ballotId) external {
        Ballot storage ballot = _getBallot(ballotId);
        if (ballot.state != BallotState.Resolved) revert BallotNotResolved(ballotId);
        if (!ballot.passed) revert BallotNotPassed(ballotId);
        if (ballot.executed) revert PayoutAlreadyExecuted(ballotId);

        ballot.executed = true;
        payoutToken.confidentialTransfer(ballot.beneficiary, ballot.payoutAmount);

        emit PayoutExecuted(ballotId, ballot.beneficiary);
    }

    /// @notice Number of ballots created so far.
    function ballotCount() external view returns (uint256) {
        return _ballots.length;
    }

    /// @notice Public metadata and, once resolved, the cleartext result of a ballot.
    function getBallot(
        uint256 ballotId
    )
        external
        view
        returns (
            string memory description,
            address beneficiary,
            uint64 startTime,
            uint64 endTime,
            BallotState state,
            uint64 yesVotes,
            uint64 noVotes,
            bool passed,
            bool executed
        )
    {
        Ballot storage ballot = _getBallot(ballotId);
        return (
            ballot.description,
            ballot.beneficiary,
            ballot.startTime,
            ballot.endTime,
            ballot.state,
            ballot.yesVotes,
            ballot.noVotes,
            ballot.passed,
            ballot.executed
        );
    }

    /// @notice The encrypted tally handles, for off-chain decryption after close.
    function getEncryptedTallies(uint256 ballotId) external view returns (euint64 encryptedYes, euint64 encryptedNo) {
        Ballot storage ballot = _getBallot(ballotId);
        return (ballot.encryptedYes, ballot.encryptedNo);
    }

    /// @notice Whether `voter` has already voted on `ballotId`.
    function hasVoted(uint256 ballotId, address voter) external view returns (bool) {
        return _hasVoted[ballotId][voter];
    }

    function _getBallot(uint256 ballotId) private view returns (Ballot storage) {
        if (ballotId >= _ballots.length) revert UnknownBallot(ballotId);
        return _ballots[ballotId];
    }
}
