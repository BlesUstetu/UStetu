// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IUStetuRegistry} from "../interfaces/IUStetuRegistry.sol";
import {UStetuTypes} from "../libraries/UStetuTypes.sol";
import {UStetuErrors} from "../libraries/UStetuErrors.sol";

interface IERC20MetadataLikeSepolia {
    function decimals() external view returns (uint8);
}

/// @notice Base Sepolia-only registry used for integration testing.
/// @dev This is NOT the V1 Mainnet registry and must never be used for production deployment.
contract UStetuRegistryBaseSepolia is IUStetuRegistry {
    uint256 public constant BASE_SEPOLIA_CHAIN_ID = 84532;
    uint8 public constant MAX_TOKEN_DECIMALS = 36;

    uint256 public immutable deploymentChainId;
    address public immutable paymentToken;

    mapping(bytes32 => UStetuTypes.Token) private _tokens;
    mapping(bytes32 => bool) private _tokenExists;

    event TokenRegistered(
        bytes32 indexed tokenId,
        uint256 indexed chainId,
        address indexed token,
        address registeredBy,
        uint8 decimalsSnapshot
    );

    constructor(address paymentToken_) {
        if (paymentToken_ == address(0)) revert UStetuErrors.InvalidPaymentToken();
        if (paymentToken_.code.length == 0) revert UStetuErrors.NotAContract();

        uint8 paymentDecimals;
        try IERC20MetadataLikeSepolia(paymentToken_).decimals() returns (uint8 decimals_) {
            paymentDecimals = decimals_;
        } catch {
            revert UStetuErrors.InvalidPaymentToken();
        }
        if (paymentDecimals > MAX_TOKEN_DECIMALS) revert UStetuErrors.InvalidTokenDecimals();

        deploymentChainId = BASE_SEPOLIA_CHAIN_ID;
        paymentToken = paymentToken_;
    }

    function registerToken(uint256 chainId, address token)
        external
        returns (bytes32 tokenId)
    {
        if (chainId != deploymentChainId) revert UStetuErrors.InvalidChainId();
        if (token == address(0)) revert UStetuErrors.InvalidAddress();
        if (token.code.length == 0) revert UStetuErrors.NotAContract();

        tokenId = getTokenId(chainId, token);
        if (_tokenExists[tokenId]) revert UStetuErrors.TokenAlreadyRegistered();

        uint8 decimalsSnapshot;
        try IERC20MetadataLikeSepolia(token).decimals() returns (uint8 decimals_) {
            decimalsSnapshot = decimals_;
        } catch {
            revert UStetuErrors.UnsupportedToken();
        }
        if (decimalsSnapshot > MAX_TOKEN_DECIMALS) revert UStetuErrors.InvalidTokenDecimals();

        _tokens[tokenId] = UStetuTypes.Token({
            chainId: chainId,
            contractAddress: token,
            decimalsSnapshot: decimalsSnapshot,
            registeredBy: msg.sender,
            registeredAt: uint64(block.timestamp)
        });
        _tokenExists[tokenId] = true;

        emit TokenRegistered(tokenId, chainId, token, msg.sender, decimalsSnapshot);
    }

    function getToken(bytes32 tokenId)
        external
        view
        returns (UStetuTypes.Token memory)
    {
        if (!_tokenExists[tokenId]) revert UStetuErrors.TokenNotRegistered();
        return _tokens[tokenId];
    }

    function isRegisteredToken(bytes32 tokenId) external view returns (bool) {
        return _tokenExists[tokenId];
    }

    function getPaymentToken() external view returns (address) {
        return paymentToken;
    }

    function getDeploymentChainId() external view returns (uint256) {
        return deploymentChainId;
    }

    function getTokenId(uint256 chainId, address token)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode("USTETU_TOKEN_V1", chainId, token));
    }
}
