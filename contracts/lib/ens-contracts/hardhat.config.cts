// from @nomicfoundation/hardhat-toolbox-viem to avoid module issue
import '@ensdomains/hardhat-toolbox-viem-extended'
import '@nomicfoundation/hardhat-ignition-viem'
import '@nomicfoundation/hardhat-verify'
import '@nomicfoundation/hardhat-viem'
import 'hardhat-gas-reporter'
import 'solidity-coverage'

import dotenv from 'dotenv'
import 'hardhat-abi-exporter'
import 'hardhat-contract-sizer'
import 'hardhat-deploy'
import { HardhatUserConfig } from 'hardhat/config'

import('@ensdomains/hardhat-chai-matchers-viem')

// hardhat actions
import { arbitrum, optimism } from 'viem/chains'
import './tasks/create_l2_safe.cts'
import './tasks/esm_fix.cjs'
import './tasks/etherscan-multichain.cts'

// Load environment variables from .env file. Suppress warnings using silent
// if this file is missing. dotenv will never modify any environment variables
// that have already been set.
// https://github.com/motdotla/dotenv
dotenv.config({ debug: false })

let real_accounts = undefined
if (process.env.DEPLOYER_KEY) {
  real_accounts = [
    process.env.DEPLOYER_KEY,
    ...(process.env.OWNER_KEY ? [process.env.OWNER_KEY] : []),
  ]
}
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY!
// circular dependency shared with actions
export const archivedDeploymentPath = './deployments/archive'

const config = {
  networks: {
    hardhat: {
      saveDeployments: false,
      tags: ['test', 'legacy', 'use_root', 'local'],
      allowUnlimitedContractSize: false,
      chainId: process.env.FORKING_ENABLED ? 1 : 31337,
      forking: {
        url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
        enabled: !!process.env.FORKING_ENABLED,
      },
    },
    localhost: {
      url: 'http://127.0.0.1:8545/',
      saveDeployments: false,
      tags: ['test', 'legacy', 'use_root', 'local'],
    },
    anvil: {
      url: `http://localhost:${parseInt(process.env['RPC_PORT'] || '8545')}`,
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      tags: ['test', 'legacy', 'use_root', 'testnet'],
      chainId: 11155111,
      accounts: real_accounts,
      ...(process.env.IMPERSONATION_PROXY_ENABLED
        ? {
            url: 'http://127.0.0.1:8546',
            tags: ['test', 'legacy', 'use_root', 'testnet', 'tenderly'],
            accounts: 'remote',
            saveDeployments: false,
          }
        : {}),
    },
    optimism: {
      url: optimism.rpcUrls.default.http[0],
      chainId: optimism.id,
      accounts: real_accounts,
      tags: ['l2'],
    },
    optimismSepolia: {
      url: 'https://sepolia.optimism.io',
      chainId: 11155420,
      accounts: real_accounts,
      tags: ['l2', 'testnet'],
    },
    base: {
      url: 'https://mainnet.base.org',
      chainId: 8453,
      accounts: real_accounts,
      tags: ['l2'],
    },
    baseSepolia: {
      url: 'https://sepolia.base.org',
      chainId: 84532,
      accounts: real_accounts,
      tags: ['l2', 'testnet'],
    },
    arbitrum: {
      url: arbitrum.rpcUrls.default.http[0],
      chainId: arbitrum.id,
      accounts: real_accounts,
      tags: ['l2'],
    },
    arbitrumSepolia: {
      url: 'https://sepolia-rollup.arbitrum.io/rpc',
      chainId: 421614,
      accounts: real_accounts,
      tags: ['l2', 'testnet'],
    },
    scroll: {
      url: 'https://rpc.scroll.io',
      chainId: 534352,
      accounts: real_accounts,
      tags: ['l2'],
    },
    scrollSepolia: {
      url: 'https://sepolia-rpc.scroll.io',
      chainId: 534351,
      accounts: real_accounts,
      tags: ['l2', 'testnet'],
    },
    linea: {
      url: 'https://rpc.linea.build',
      chainId: 59144,
      accounts: real_accounts,
      tags: ['l2'],
    },
    lineaSepolia: {
      url: 'https://rpc.sepolia.linea.build',
      chainId: 59141,
      accounts: real_accounts,
      tags: ['l2', 'testnet'],
    },
    holesky: {
      url: `https://holesky.gateway.tenderly.co`,
      tags: ['test', 'legacy', 'use_root', 'testnet'],
      chainId: 17000,
      accounts: real_accounts,
      ...(process.env.IMPERSONATION_PROXY_ENABLED
        ? {
            url: 'http://127.0.0.1:8546',
            tags: ['test', 'legacy', 'use_root', 'testnet', 'tenderly'],
            accounts: 'remote',
            saveDeployments: false,
          }
        : {}),
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      tags: ['legacy', 'use_root'],
      chainId: 1,
      accounts: real_accounts,
      ...(process.env.IMPERSONATION_PROXY_ENABLED
        ? {
            url: 'http://127.0.0.1:8546',
            tags: ['legacy', 'use_root', 'tenderly'],
            accounts: 'remote',
            saveDeployments: false,
          }
        : {}),
    },
  },
  mocha: {},
  solidity: {
    compilers: [
      {
        version: '0.8.26',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1_000_000,
          },
          metadata: {
            useLiteralContent: true,
          },
        },
      },
      {
        version: '0.8.17',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1200,
          },
        },
      },
      // for DummyOldResolver contract
      {
        version: '0.4.11',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
    overrides: {
      'contracts/wrapper/NameWrapper.sol': {
        version: '0.8.17',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1200,
          },
        },
      },
    },
  },
  abiExporter: {
    path: './build/contracts',
    runOnCompile: true,
    clear: true,
    flat: true,
    except: [
      'Controllable$',
      'INameWrapper$',
      'SHA1$',
      'Ownable$',
      'NameResolver$',
      'TestBytesUtils$',
      'legacy/*',
    ],
    spacing: 2,
    pretty: true,
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    owner: {
      default: process.env.OWNER_KEY ? 1 : 0,
      1: '0xFe89cc7aBB2C4183683ab71653C4cdc9B02D44b7',
      11155111: '0x0F32b753aFc8ABad9Ca6fE589F707755f4df2353',
      17000: '0x0F32b753aFc8ABad9Ca6fE589F707755f4df2353',
    },
  },
  gasReporter: {
    enabled: true,
  },
  etherscan: {
    apiKey: {
      optimismSepolia: ETHERSCAN_API_KEY,
      baseSepolia: ETHERSCAN_API_KEY,
      base: ETHERSCAN_API_KEY,
      arbitrumSepolia: ETHERSCAN_API_KEY,
    },
    customChains: [
      {
        network: 'optimismSepolia',
        chainId: 11155420,
        urls: {
          apiURL: 'https://api-sepolia-optimism.etherscan.io/api',
          browserURL: 'https://sepolia-optimism.etherscan.io',
        },
      },
      {
        network: 'baseSepolia',
        chainId: 84532,
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org',
        },
      },
      {
        network: 'base',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.basescan.org/api',
          browserURL: 'https://basescan.org',
        },
      },
      {
        network: 'arbitrumSepolia',
        chainId: 421614,
        urls: {
          apiURL: 'https://api-sepolia.arbiscan.io/api',
          browserURL: 'https://api-sepolia.arbiscan.io',
        },
      },
    ],
  },
  external: {
    contracts: [
      {
        artifacts: [
          archivedDeploymentPath,
          './node_modules/@unruggable/gateways/artifacts',
        ],
      },
    ],
  },
} satisfies HardhatUserConfig

export default config
