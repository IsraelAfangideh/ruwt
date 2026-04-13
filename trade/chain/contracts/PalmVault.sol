// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PalmVault — Long-only commodity futures vault with spread-based pricing
/// @notice Users go long at the order book's ask price and sell at the bid price.
///         The vault acts as an automated market maker, posting bid/ask around the
///         oracle price with a 2% spread. Revenue comes from the spread, not fees.
///         The operator (backend matching engine) submits trade prices from the
///         order book. This is an intentional V1 trust assumption.
contract PalmVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdt;
    address public operator;

    uint256 public vaultBalance;
    uint256 public totalOpenInterest;
    uint256 public nextPositionId;
    uint256 public lastTradePrice;

    uint256 public constant MAX_POSITION = 100e6; // $100 USDT (6 decimals)
    uint256 public constant PRICE_PRECISION = 1e6;
    uint256 public constant MIN_PRICE = 100 * PRICE_PRECISION;    // $100/MT
    uint256 public constant MAX_PRICE = 100_000 * PRICE_PRECISION; // $100,000/MT

    // Packed: slot 0 = trader(20) + active(1) + openedAt(8) = 29 bytes
    struct Position {
        address trader;
        bool active;
        uint64 openedAt;
        uint256 margin;      // slot 1
        uint256 entryPrice;  // slot 2 — trade price at open (from order book)
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
        uint256 tradePrice
    );
    event LongClosed(
        uint256 indexed positionId,
        address indexed trader,
        uint256 tradePrice,
        int256 pnl,
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
    // Operator — execute trades from order book
    // ---------------------------------------------------------------

    /// @notice Open a long position at the matched trade price.
    /// @param trader     The trader's address
    /// @param margin     USDT amount to lock (max $100)
    /// @param tradePrice Price from order book match (USD per MT * PRICE_PRECISION)
    function openLong(
        address trader,
        uint256 margin,
        uint256 tradePrice
    ) external onlyOperator nonReentrant returns (uint256 positionId) {
        if (margin == 0 || margin > MAX_POSITION) revert ExceedsMaxPosition();
        if (tradePrice < MIN_PRICE || tradePrice > MAX_PRICE) revert InvalidPrice();
        if (balances[trader] < margin) revert InsufficientBalance();
        if (totalOpenInterest + margin > vaultBalance) revert OICapExceeded();

        balances[trader] -= margin;
        totalOpenInterest += margin;
        lastTradePrice = tradePrice;

        positionId = nextPositionId++;
        positions[positionId] = Position({
            trader: trader,
            active: true,
            openedAt: uint64(block.timestamp),
            margin: margin,
            entryPrice: tradePrice
        });

        emit LongOpened(positionId, trader, margin, tradePrice);
    }

    /// @notice Close a long position at the matched trade price.
    /// @param positionId The position to close
    /// @param tradePrice Price from order book match (USD per MT * PRICE_PRECISION)
    function closeLong(
        uint256 positionId,
        uint256 tradePrice
    ) external onlyOperator nonReentrant {
        Position storage pos = positions[positionId];
        if (!pos.active) revert PositionNotActive();
        if (tradePrice < MIN_PRICE || tradePrice > MAX_PRICE) revert InvalidPrice();

        address trader = pos.trader;
        uint256 margin = pos.margin;
        uint256 entryPrice = pos.entryPrice;

        pos.active = false;
        totalOpenInterest -= margin;
        lastTradePrice = tradePrice;

        // PnL = margin * (tradePrice - entryPrice) / entryPrice
        int256 pnl = int256(margin)
            * (int256(tradePrice) - int256(entryPrice))
            / int256(entryPrice);

        // Payout = margin + pnl, floored at 0
        uint256 payout;
        if (pnl >= 0) {
            uint256 profit = uint256(pnl);
            if (profit > vaultBalance) {
                profit = vaultBalance;
                pnl = int256(profit);
            }
            payout = margin + profit;
            vaultBalance -= profit;
        } else {
            uint256 loss = uint256(-pnl);
            if (loss >= margin) {
                payout = 0;
                vaultBalance += margin;
                pnl = -int256(margin);
            } else {
                payout = margin - loss;
                vaultBalance += loss;
            }
        }

        if (payout > 0) {
            balances[trader] += payout;
        }

        emit LongClosed(positionId, trader, tradePrice, pnl, payout);
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
