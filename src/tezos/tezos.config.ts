import { TokenListType } from "../utils";

export interface NetworkConfig {
  name: string;
  chainId: string;
  nodeURL: string;
  tokenListType: TokenListType;
  tokenListSource: string;
}

export interface Config {
  network: NetworkConfig;
}

export function getTezosConfig(): Config {
  return {
    network: {
      name: 'tezos',
      chainId: 'mainnet',
      nodeURL: 'https://tezosrpc.midl.dev/ak-xaqvt0f64dajnu',
      tokenListType: 'FILE',
      tokenListSource: 'src/tezos/tezos.mainnet.tokens.json',
    },
  };
}