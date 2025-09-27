import { mainnet, scroll, scrollSepolia, sepolia } from 'viem/chains'
import { createChainReverseResolverDeployer } from '../../../test/fixtures/createChainReverseResolverDeployment.js'
import { safeConfig } from '../../l2/00_deploy_l2_reverse_registrar.js'

export default createChainReverseResolverDeployer({
  chainName: 'Scroll',
  targets: {
    [sepolia.id]: {
      chain: scrollSepolia.id,
      verifier: '0xd126DD79133D3aaf0248E858323Cd10C04c5E43d',
      registrar: safeConfig.testnet.expectedDeploymentAddress,
      gateways: [
        'https://lb.drpc.org/gateway/unruggable?network=scroll-sepolia',
        'https://scroll-sepolia.3668.io',
      ],
    },
    [mainnet.id]: {
      chain: scroll.id,
      verifier: '0xe439F14Aaf43c87e3dfBDB0A470D9EB2C7f27d93',
      registrar: safeConfig.mainnet.expectedDeploymentAddress,
      gateways: [
        'https://lb.drpc.org/gateway/unruggable?network=scroll',
        'https://scroll.3668.io',
      ],
    },
  },
})
