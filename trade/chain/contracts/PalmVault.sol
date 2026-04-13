// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PalmVault — Long-only commodity futures vault
/// @notice Users go long on palm oil at oracle price. The vault is the counterparty.
///         No leverage. 3% fee on close. Total open interest capped at vault balance.
///         The operator (backend hot wallet) submits oracle prices — positions cannot
///         be opened or closed without it. This is an intentional V1 trust assumption.
contract PalmVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdt;
    address public operator;

    uint256 public vaultBalance;
    uint256 public totalOpenInterest;
    uint256 public nextPositionId;

    uint256 public constant CLOSE_FEE_BPS = 300;
    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_POSITION = 100e6; // $100 USDT (6 decimals)
    uint256 public constant PRICE_PRECISION = 1e6;
    uint256 public constant MIN_PRICE = 100 * PRICE_PRECISION;    // $100/MT
    uint256 public constant MAX_PRICE = 100_000 * PRICE_PRECISION; // $100,000/MT

    // Packed into 2 storage slots instead of 4:
    // slot 0: trader (20 bytes) + active (1 byte) + openedAt (8 bytes) = 29 bytes
    // slot 1: margin (32 bytes)
    // slot 2: entryPrice (32 bytes)
    struct Position {
        address trader;      // 20 bytes ─┐
        bool active;         //  1 byte   │ slot 0
        uint64 openedAt;     //  8 bytes ─┘
        uint256 margin;      // slot 1
        uint256 entryPrice;  // slot 2 — USD per MT, scaled by PRICE_PRECISION
    }

    mapping(uint256 => Position) public positions;
    mapping(address => uint256) public balances;

    event VaultSeeded(address indexed from, uint256 amount);
    event VaultWithdrawn(address indexed to, uint256 amount);
    event Deposited(address indexed trader, uint256 amount);
    event Withdrawn(address indexed trader, uint256 amount);
    event LongOpened(
        uint256 indexed positionId,
        address indexed trader,
        uint256 margin,
        uint256 entryPrice
    );
    event LongClosed(
        uint256 indexed positionId,
        address indexed trader,
        uint256 exitPrice,
        int256 pnl,
        uint256 fee,
        uint256 payout
    );
    event OperatorSet(address indexed operator);

    error NotOperator();
    error InvalidAmount();
    error InvalidPrice();
    error ZeroAddress();
    error InsufficientBalance();
    error OICapExceeded();
    error PositionNotActive();
    error ExceedsMaxPosition();

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor(address _usdt, address _operator) Ownable(msg.sender) {
        if (_usdt == address(0) || _operator == address(0)) revert ZeroAddress();
        usdt = IERC20(_usdt);
        operator = _operator;
        emit OperatorSet(_operator);
    }

    // ---------------------------------------------------------------
    // Owner
    // ---------------------------------------------------------------

    function seedVault(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidAmount();
        usdt.safeTransferFrom(msg.sender, address(this), amount);
        vaultBalance += amount;
        emit VaultSeeded(msg.sender, amount);
    }

    function withdrawVault(uint256 amount) external onlyOwner nonReentrant {
        uint256 available = vaultBalance - totalOpenInterest;
        if (amount > available) revert InsufficientBalance();
        vaultBalance -= amount;
        usdt.safeTransfer(msg.sender, amount);
        emit VaultWithdrawn(msg.sender, amount);
    }

    function setOperator(address _operator) external onlyOwner {
        if (_operator == address(0)) revert ZeroAddress();
        operator = _operator;
        emit OperatorSet(_operator);
    }

    // ---------------------------------------------------------------
    // User — deposit & withdraw
    // ---------------------------------------------------------------

    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        usdt.safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0 || balances[msg.sender] < amount)
            revert InsufficientBalance();
        balances[msg.sender] -= amount;
        usdt.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // ---------------------------------------------------------------
    // Operator — open & close positions
    // ---------------------------------------------------------------

    /// @notice Open a long position for a trader at the given oracle price.
    /// @param trader  The trader's address
    /// @param margin  USDT amount to lock (max $100)
    /// @param entryPrice  Current palm oil price (USD per MT * PRICE_PRECISION)
    function openLong(
        address trader,
        uint256 margin,
        uint256 entryPrice
    ) external onlyOperator nonReentrant returns (uint256 positionId) {
        if (margin == 0 || margin > MAX_POSITION) revert ExceedsMaxPosition();
        if (entryPrice < MIN_PRICE || entryPrice > MAX_PRICE) revert InvalidPrice();
        if (balances[trader] < margin) revert InsufficientBalance();
        if (totalOpenInterest + margin > vaultBalance) revert OICapExceeded();

        balances[trader] -= margin;
        totalOpenInterest += margin;

        positionId = nextPositionId++;
        positions[positionId] = Position({
            trader: trader,
            active: true,
            openedAt: uint64(block.timestamp),
            margin: margin,
            entryPrice: entryPrice
        });

        emit LongOpened(positionId, trader, margin, entryPrice);
    }

    /// @notice Close a long position at the given oracle price.
    /// @param positionId  The position to close
    /// @param exitPrice   Current palm oil price (USD per MT * PRICE_PRECISION)
    function closeLong(
        uint256 positionId,
        uint256 exitPrice
    ) external onlyOperator nonReentrant {
        Position storage pos = positions[positionId];
        if (!pos.active) revert PositionNotActive();
        if (exitPrice < MIN_PRICE || exitPrice > MAX_PRICE) revert InvalidPrice();

        // Cache storage reads into stack variables
        address trader = pos.trader;
        uint256 margin = pos.margin;
        uint256 entryPrice = pos.entryPrice;

        pos.active = false;
        totalOpenInterest -= margin;

        // PnL = margin * (exitPrice - entryPrice) / entryPrice
        int256 pnl = int256(margin)
            * (int256(exitPrice) - int256(entryPrice))
            / int256(entryPrice);

        // Gross payout = margin + pnl, floored at 0
        uint256 grossPayout;
        if (pnl >= 0) {
            uint256 profit = uint256(pnl);
            if (profit > vaultBalance) {
                profit = vaultBalance;
                pnl = int256(profit);
            }
            grossPayout = margin + profit;
            vaultBalance -= profit;
        } else {
            uint256 loss = uint256(-pnl);
            if (loss >= margin) {
                grossPayout = 0;
                vaultBalance += margin;
                pnl = -int256(margin);
            } else {
                grossPayout = margin - loss;
                vaultBalance += loss;
            }
        }

        // 3% fee on whatever the trader receives
        uint256 fee = (grossPayout * CLOSE_FEE_BPS) / BPS;
        uint256 netPayout = grossPayout - fee;

        // Fee accrues to vault
        vaultBalance += fee;

        // Credit trader's balance
        if (netPayout > 0) {
            balances[trader] += netPayout;
        }

        emit LongClosed(positionId, trader, exitPrice, pnl, fee, netPayout);
    }

    // ---------------------------------------------------------------
    // View helpers
    // ---------------------------------------------------------------

    function getPosition(uint256 positionId) external view returns (Position memory) {
        return positions[positionId];
    }

    function availableCapacity() external view returns (uint256) {
        if (vaultBalance <= totalOpenInterest) return 0;
        return vaultBalance - totalOpenInterest;
    }

    function traderBalance(address trader) external view returns (uint256) {
        return balances[trader];
    }
}
