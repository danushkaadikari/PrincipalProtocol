# Principal Protocol MVP

A decentralized platform for real estate project funding through NFTs. Users can participate in funding real estate projects by purchasing NFTs of their chosen projects.

## Smart Contracts

The project consists of the following smart contracts:

- `AdminRegistry.sol`: Manages admin roles and permissions
- `RealEstateNFT.sol`: ERC721 contract for project NFTs with batch minting capability
- `RealEstateNFTFactory.sol`: Factory contract for creating new NFT collections
- `MockUSDT.sol`: Test USDT token for development and testing

## Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd PrincipalProtocol-mvp
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your configuration:
```env
SEPOLIA_URL=your_sepolia_rpc_url
PRIVATE_KEY=your_wallet_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

## Development

### Local Development

1. Start a local Hardhat node:
```bash
npm run node
```

2. In a new terminal, deploy the contracts locally:
```bash
npm run deploy:local
```

### Testing

Run the test suite:
```bash
npm test
```

### Deployment

Deploy to Sepolia testnet:
```bash
npm run deploy:sepolia
```

## Contract Addresses

### Sepolia Testnet
- MockUSDT: [`0xad959BF6614909Fd8F9E2BAe8119E13D12E8f9D3`](https://sepolia.etherscan.io/address/0xad959BF6614909Fd8F9E2BAe8119E13D12E8f9D3)
- AdminRegistry: [`0xe44b3226a02b5eA0146B76C20AE608622d97E2F4`](https://sepolia.etherscan.io/address/0xe44b3226a02b5eA0146B76C20AE608622d97E2F4)
- RealEstateNFTFactory: [`0x9E56bd6Df995A8ED0fac9F5c70321e6651c032eF`](https://sepolia.etherscan.io/address/0x9E56bd6Df995A8ED0fac9F5c70321e6651c032eF)

## Features

- Super Admin functionality:
  - Add/remove admin wallets
  - Owns all NFT collections
  - Emergency pause/unpause capability

- Regular Admin functionality:
  - Create new real estate projects
  - Deploy NFT collections
  - Modify project details

- User functionality:
  - View all real estate projects
  - Purchase NFTs using USDT
  - Batch mint multiple NFTs
  - View owned NFTs

## Security

- ReentrancyGuard implementation
- Pause mechanism for emergency situations
- Role-based access control
- Safe USDT transfers

## License

MIT
