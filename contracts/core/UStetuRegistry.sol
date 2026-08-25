// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IUStetuRegistry} from "../interfaces/IUStetuRegistry.sol";
import {UStetuTypes} from "../libraries/UStetuTypes.sol";
import {UStetuErrors} from "../libraries/UStetuErrors.sol";

/**
 * @title UStetuRegistry
 * @notice Canonical registry for approved tokens and supported payment assets.
 * @dev Financial custody and settlement are intentionally outside this contract.
 */
contract UStetuRegistry is AccessControl, IUStetuRegistry {
    bytes32 public constant VERIFIER_ROLE = keccak256("USTETU_TOKEN_VERIFIER_ROLE");
    bytes32 public constant CONFIG_ROLE = keccak256("USTETU_CONFIG_ROLE");

    uint256 public immutable deploymentChainId;

    mapping(bytes32 => UStetuTypes.Token) private _tokens;
    mapping(bytes32 => bool) private _tokenExists;
    mapping(address => bool) private _supportedPaymentTokens;

    event TokenRegistered(
        bytes32 indexed tokenId,
        uint256 indexed chainId,
        address indexed token,
        address registeredBy
    );
    event TokenVerificationUpdated(bytes32 indexed tokenId, UStetuTypes.VerificationStatus status);
    event PaymentTokenSupportUpdated(address indexed token, bool supported);

    constructor(uint256 chainId, address admin) {
        if (admin == address(0)) revert UStetuErrors.InvalidAddress();
        if (chainId == 0) revert UStetuErrors.InvalidChainId();

        deploymentChainId = chainId;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
        _grantRole(CONFIG_ROLE, admin);
    }

    function registerToken(uint256 chainId, address token)
        external
        onlyRole(CONFIG_ROLE)
        returns (bytes32 tokenId)
    {
        if (chainId != deploymentChainId) revert UStetuErrors.InvalidChainId();
        if (token == address(0)) revert UStetuErrors.InvalidAddress();
        if (token.code.length == 0) revert UStetuErrors.NotAContract();

        tokenId = getTokenId(chainId, token);
        if (_tokenExists[tokenId]) revert UStetuErrors.TokenAlreadyRegistered();

        uint8 decimalsSnapshot;
        try IERC20MetadataLike(token).decimals() returns (uint8 decimals_) {
            decimalsSnapshot = decimals_;
        } catch {
            revert UStetuErrors.UnsupportedToken();
        }

        _tokens[tokenId] = UStetuTypes.Token({
            chainId: chainId,
            contractAddress: token,
            decimalsSnapshot: decimalsSnapshot,
            status: UStetuTypes.VerificationStatus.PENDING,
            registeredBy: msg.sender,
            registeredAt: uint64(block.timestamp)
        });
        _tokenExists[tokenId] = true;

        emit TokenRegistered(tokenId, chainId, token, msg.sender);
    }

    function setTokenVerification(bytes32 tokenId, UStetuTypes.VerificationStatus status)
        external
        onlyRole(VERIFIER_ROLE)
    {
        if (!_tokenExists[tokenId]) revert UStetuErrors.TokenNotRegistered();
        _tokens[tokenId].status = status;
        emit TokenVerificationUpdated(tokenId, status);
    }

    function setPaymentTokenSupported(address token, bool supported)
        external
        onlyRole(CONFIG_ROLE)
    {
        if (token == address(0)) revert UStetuErrors.InvalidAddress();
        if (token.code.length == 0) revert UStetuErrors.NotAContract();
        _supportedPaymentTokens[token] = supported;
        emit PaymentTokenSupportUpdated(token, supported);
    }

    function getToken(bytes32 tokenId) external view returns (UStetuTypes.Token memory) {
        if (!_tokenExists[tokenId]) revert UStetuErrors.TokenNotRegistered();
        return _tokens[tokenId];
    }

    function isApprovedToken(bytes32 tokenId) external view returns (bool) {
        return _tokenExists[tokenId]
            && _tokens[tokenId].status == UStetuTypes.VerificationStatus.APPROVED;
    }

    function isSupportedPaymentToken(address token) external view returns (bool) {
        return _supportedPaymentTokens[token];
    }

    function getDeploymentChainId() external view returns (uint256) {
        return deploymentChainId;
    }

    function getTokenId(uint256 chainId, address token) public pure returns (bytes32) {
        return keccak256(abi.encode("USTETU_TOKEN_V1", chainId, token));
    }
}

interface IERC20MetadataLike {
    function decimals() external view returns (uint8);
}
