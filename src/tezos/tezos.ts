import { readFileSync } from 'fs';
import { getTezosConfig } from './tezos.config';
import { TokenListType } from '../utils';
import { TezosToolkit } from '@taquito/taquito';
import { InMemorySigner } from '@taquito/signer';
import axios from 'axios';
import { tokens as mainnetTokens } from './tezos.mainnet.tokens';

interface TokenInfo {
  chainId: string;
  address: string;
  decimals: number;
  name: string;
  symbol: string;
  standard: string;
  tokenId: number;
}

export class Tezos {
  private _provider: TezosToolkit;
  protected tokenList: TokenInfo[] = [];
  private _tokenMap: Record<string, TokenInfo> = {};

  private _ready: boolean = false;
  private _initializing: boolean = false;
  private _initPromise: Promise<void> = Promise.resolve();

  public chainName: string = 'tezos';
  public rpcUrl: string;
  public chainId: string;
  public tokenListSource: string;
  public tokenListType: TokenListType;

  constructor() {
    const config = getTezosConfig();
    this.rpcUrl = config.network.nodeURL;
    this.chainId = config.network.chainId;
    this.tokenListType = config.network.tokenListType;
    this.tokenListSource = config.network.tokenListSource;
    this._provider = new TezosToolkit(this.rpcUrl);
  }

  ready(): boolean {
    return this._ready;
  }

  public get provider() {
    return this._provider;
  }

  async init(): Promise<void> {
    if (!this.ready() && !this._initializing) {
      this._initializing = true;
      this._initPromise = this.loadTokens(
        this.tokenListSource,
        this.tokenListType
      ).then(() => {
        this._ready = true;
        this._initializing = false;
      });
      const wallet = JSON.parse(readFileSync('./wallet.json', 'utf8'));
      const signer = await InMemorySigner.fromSecretKey(wallet.privateKey);
      this.provider.setSignerProvider(signer);
      this.provider.setRpcProvider(this.rpcUrl);
    }
    return this._initPromise;
  }

  private async loadTokens(
    tokenListSource: string,
    tokenListType: TokenListType
  ): Promise<void> {
    this.tokenList = await this.getTokenList(tokenListSource, tokenListType);
    if (this.tokenList) {
      this.tokenList.forEach(
        (token: TokenInfo) => (this._tokenMap[token.symbol] = token)
      );
    }
  }

  // returns tokens for a given list source and list type
  async getTokenList(
    tokenListSource: string,
    tokenListType: TokenListType
  ): Promise<TokenInfo[]> {
    let tokens;
    if (tokenListType === 'URL') {
      const result = await axios.get(tokenListSource);
      tokens = result.data;
    } else {
      ({ tokens } = mainnetTokens);
    }
    return tokens;
  }
}