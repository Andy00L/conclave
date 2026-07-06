// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, ebool, euint64, externalEbool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

/// @title ConfidentialBallot
/// @author Conclave
/// @notice Stake-weighted governance ballots whose individual votes stay encrypted end to
///         end, wired to a confidential treasury: a passing ballot pays its beneficiary an
///         encrypted amount, so neither the votes, the weights, nor the payout are public.
/// @dev A vote locks an encrypted amount of the ERC-7984 governance token in this contract
///      and adds that encrypted weight to exactly one of two tallies via FHE.select, so no
///      observer can tell how an address voted or with how much. The weight is provable by
///      construction: the transfer caps at the voter's balance, so nobody votes with tokens
///      they do not hold. After the ballot resolves, each voter withdraws their locked
///      stake. The treasury is tracked in its own encrypted counter, funded only through
///      fundTreasury, so a payout can never dip into voter stakes.
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
        euint64 encryptedYes; // sum of yes-vote weights (encrypted)
        euint64 encryptedNo; // sum of no-vote weights (encrypted)
        euint64 payoutAmount;
        BallotState state;
        uint64 yesWeight; // populated at resolve(), in token base units
        uint64 noWeight; // populated at resolve(), in token base units
        bool passed; // populated at resolve()
        bool executed; // set once the payout has been sent
    }

    /// @notice The confidential token staked as voting weight and paid out on a pass.
    IERC7984 public immutable payoutToken;

    /// @dev All ballots, indexed by their position in this array (the ballot id).
    Ballot[] private _ballots;

    /// @dev ballot id => voter => whether that voter already voted.
    mapping(uint256 ballotId => mapping(address voter => bool voted)) private _hasVoted;

    /// @dev ballot id => voter => the encrypted weight that voter locked in this ballot.
    mapping(uint256 ballotId => mapping(address voter => euint64 stake)) private _lockedStake;

    /// @dev ballot id => voter => whether that voter already withdrew their stake.
    mapping(uint256 ballotId => mapping(address voter => bool withdrawn)) private _hasWithdrawn;

    /// @dev The treasury available for payouts, kept apart from voter stakes so a payout
    ///      can never spend a stake. Funded only through fundTreasury, spent only by execute.
    euint64 private _treasuryBalance;

    event BallotCreated(uint256 indexed ballotId, string description, address indexed beneficiary, uint64 endTime);
    event VoteCast(uint256 indexed ballotId, address indexed voter);
    event TreasuryFunded(address indexed funder);
    event BallotClosed(uint256 indexed ballotId);
    event BallotResolved(uint256 indexed ballotId, uint64 yesWeight, uint64 noWeight, bool passed);
    event PayoutExecuted(uint256 indexed ballotId, address indexed beneficiary);
    event StakeWithdrawn(uint256 indexed ballotId, address indexed voter);

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
    error NothingToWithdraw(uint256 ballotId);
    error StakeAlreadyWithdrawn(uint256 ballotId);

    /// @param payoutToken_ The confidential ERC-7984 token staked and paid out by this contract.
    constructor(IERC7984 payoutToken_) {
        payoutToken = payoutToken_;
        _treasuryBalance = FHE.asEuint64(0);
        FHE.allowThis(_treasuryBalance);
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
                yesWeight: 0,
                noWeight: 0,
                passed: false,
                executed: false
            })
        );

        // Keep both tallies usable by this contract for later adds and public decryption.
        FHE.allowThis(initialYes);
        FHE.allowThis(initialNo);
        // The payout must stay usable by this contract (to compute and move it) and by the
        // token (to run the transfer) when execute() runs in a later transaction.
        FHE.allowThis(amount);
        FHE.allow(amount, address(payoutToken));

        emit BallotCreated(ballotId, description, beneficiary, endTime);
    }

    /// @notice Fund the payout treasury with an encrypted amount of the governance token.
    ///         Anyone may top it up; the funded amount is tracked apart from voter stakes.
    /// @dev The funder must first make this contract an operator on the token
    ///      (token.setOperator), so this contract can pull the tokens.
    function fundTreasury(externalEuint64 amount, bytes calldata inputProof) external {
        euint64 contribution = FHE.fromExternal(amount, inputProof);
        FHE.allow(contribution, address(payoutToken));

        euint64 received = payoutToken.confidentialTransferFrom(msg.sender, address(this), contribution);

        _treasuryBalance = FHE.add(_treasuryBalance, received);
        FHE.allowThis(_treasuryBalance);

        emit TreasuryFunded(msg.sender);
    }

    /// @notice Cast one stake-weighted vote. `support` true adds the locked weight to yes,
    ///         false to no. One vote per address; the weight is the token amount locked.
    /// @dev The voter must first make this contract an operator on the token
    ///      (token.setOperator) so it can pull the stake. `support` and `amount` are two
    ///      values in one encrypted input, sharing `inputProof`.
    function vote(
        uint256 ballotId,
        externalEbool support,
        externalEuint64 amount,
        bytes calldata inputProof
    ) external {
        Ballot storage ballot = _getBallot(ballotId);
        if (ballot.state != BallotState.Active) revert BallotNotActive(ballotId);
        if (block.timestamp > ballot.endTime) revert VotingPeriodOver(ballotId);
        if (_hasVoted[ballotId][msg.sender]) revert AlreadyVoted(ballotId);

        _hasVoted[ballotId][msg.sender] = true;

        ebool choice = FHE.fromExternal(support, inputProof);
        euint64 requestedStake = FHE.fromExternal(amount, inputProof);
        FHE.allow(requestedStake, address(payoutToken));

        // Pull the stake from the voter. The transfer caps at their balance, so the weight
        // is the amount actually moved: nobody votes with tokens they do not hold.
        euint64 weight = payoutToken.confidentialTransferFrom(msg.sender, address(this), requestedStake);

        // Add the encrypted weight to exactly one tally, without revealing which.
        euint64 zero = FHE.asEuint64(0);
        ballot.encryptedYes = FHE.add(ballot.encryptedYes, FHE.select(choice, weight, zero));
        ballot.encryptedNo = FHE.add(ballot.encryptedNo, FHE.select(choice, zero, weight));
        FHE.allowThis(ballot.encryptedYes);
        FHE.allowThis(ballot.encryptedNo);

        // Remember the locked weight so the voter can reclaim it after the ballot resolves.
        _lockedStake[ballotId][msg.sender] = weight;
        FHE.allowThis(weight);
        FHE.allow(weight, address(payoutToken));

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
    ///         these handles, so the stored result cannot be forged. The tallies are the
    ///         summed yes and no weights, in token base units.
    function resolve(uint256 ballotId, bytes calldata cleartexts, bytes calldata decryptionProof) external {
        Ballot storage ballot = _getBallot(ballotId);
        if (ballot.state != BallotState.Revealing) revert BallotNotRevealing(ballotId);

        bytes32[] memory handles = new bytes32[](2);
        handles[0] = FHE.toBytes32(ballot.encryptedYes);
        handles[1] = FHE.toBytes32(ballot.encryptedNo);
        FHE.checkSignatures(handles, cleartexts, decryptionProof);

        (uint64 yesWeight, uint64 noWeight) = abi.decode(cleartexts, (uint64, uint64));
        ballot.yesWeight = yesWeight;
        ballot.noWeight = noWeight;
        ballot.passed = yesWeight > noWeight;
        ballot.state = BallotState.Resolved;

        emit BallotResolved(ballotId, yesWeight, noWeight, ballot.passed);
    }

    /// @notice Pay the beneficiary the encrypted payout if the ballot passed. The amount
    ///         stays confidential; only the fact that a payout happened becomes public.
    /// @dev Draws only from the treasury counter, capped at the treasury balance, so voter
    ///      stakes are never spent. Funding the treasury (fundTreasury) is a prerequisite.
    function execute(uint256 ballotId) external {
        Ballot storage ballot = _getBallot(ballotId);
        if (ballot.state != BallotState.Resolved) revert BallotNotResolved(ballotId);
        if (!ballot.passed) revert BallotNotPassed(ballotId);
        if (ballot.executed) revert PayoutAlreadyExecuted(ballotId);

        ballot.executed = true;

        // Pay min(payout, treasury): never more than the treasury holds.
        ebool payoutFits = FHE.le(ballot.payoutAmount, _treasuryBalance);
        euint64 actualPayout = FHE.select(payoutFits, ballot.payoutAmount, _treasuryBalance);

        _treasuryBalance = FHE.sub(_treasuryBalance, actualPayout);
        FHE.allowThis(_treasuryBalance);
        FHE.allowThis(actualPayout);
        FHE.allow(actualPayout, address(payoutToken));

        payoutToken.confidentialTransfer(ballot.beneficiary, actualPayout);

        emit PayoutExecuted(ballotId, ballot.beneficiary);
    }

    /// @notice Reclaim the stake locked when voting, once the ballot has resolved. One
    ///         withdrawal per voter per ballot.
    function withdraw(uint256 ballotId) external {
        Ballot storage ballot = _getBallot(ballotId);
        if (ballot.state != BallotState.Resolved) revert BallotNotResolved(ballotId);
        if (!_hasVoted[ballotId][msg.sender]) revert NothingToWithdraw(ballotId);
        if (_hasWithdrawn[ballotId][msg.sender]) revert StakeAlreadyWithdrawn(ballotId);

        _hasWithdrawn[ballotId][msg.sender] = true;

        euint64 stake = _lockedStake[ballotId][msg.sender];
        FHE.allow(stake, address(payoutToken));
        payoutToken.confidentialTransfer(msg.sender, stake);

        emit StakeWithdrawn(ballotId, msg.sender);
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
            uint64 yesWeight,
            uint64 noWeight,
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
            ballot.yesWeight,
            ballot.noWeight,
            ballot.passed,
            ballot.executed
        );
    }

    /// @notice The encrypted tally handles, for off-chain decryption after close.
    function getEncryptedTallies(uint256 ballotId) external view returns (euint64 encryptedYes, euint64 encryptedNo) {
        Ballot storage ballot = _getBallot(ballotId);
        return (ballot.encryptedYes, ballot.encryptedNo);
    }

    /// @notice The encrypted weight `voter` locked in `ballotId`. Only the voter (and this
    ///         contract) can decrypt it.
    function getLockedStake(uint256 ballotId, address voter) external view returns (euint64) {
        return _lockedStake[ballotId][voter];
    }

    /// @notice Whether `voter` has already voted on `ballotId`.
    function hasVoted(uint256 ballotId, address voter) external view returns (bool) {
        return _hasVoted[ballotId][voter];
    }

    /// @notice Whether `voter` has already withdrawn their stake from `ballotId`.
    function hasWithdrawn(uint256 ballotId, address voter) external view returns (bool) {
        return _hasWithdrawn[ballotId][voter];
    }

    function _getBallot(uint256 ballotId) private view returns (Ballot storage) {
        if (ballotId >= _ballots.length) revert UnknownBallot(ballotId);
        return _ballots[ballotId];
    }
}
