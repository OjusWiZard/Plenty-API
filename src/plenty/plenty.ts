import { PlentyConfig } from './plenty.config';
import { IConfigPool, IConfigToken, IPoolData } from './plenty.types';
import { Tezos } from "../tezos/tezos";
import { isFractionString } from "../utils";
import fetch from 'node-fetch';

export class Plenty {
  private _ctezAdminAddress: string;
  private _router: string;
  private _poolsApi: string;
  private _tokenList: Record<string, IConfigToken> = {};
  private _pools: Record<string, IConfigPool> = {};
  private _ready: boolean = false;
  public isPlenty = true;

  constructor() {
    const config = PlentyConfig.config;
    this._router = config.routerAddress;
    this._poolsApi = config.poolsApi;
    this._ctezAdminAddress = config.ctezAdminAddress;
  }

  /**
   * Given a token's address, return the connector's native representation of
   * the token.
   *
   * @param address Token address
   */
  public getTokenBySymbol(symbol: string): IConfigToken {
    return this._tokenList[symbol];
  }

  public async init() {
    if (!this.ready()) {
      const apiResponse = await fetch(this._poolsApi);
      const apiJson: Record<string, IConfigPool> = await apiResponse.json() as Record<string, IConfigPool>;
      for (const poolAddress in apiJson) {
        const pool = apiJson[poolAddress];
        if (pool.token1.symbol === 'SEB' || pool.token2.symbol === 'SEB') {
          continue;
        }
        if (pool.token1.symbol === 'PEPE' || pool.token2.symbol === 'PEPE') {
          continue;
        }
        let tokensKey = pool.token1.symbol + '-' + pool.token2.symbol;
        if (pool.token1.symbol > pool.token2.symbol) {
          tokensKey = pool.token2.symbol + '-' + pool.token1.symbol;
        }
        this._pools[tokensKey] = pool;
        if (!(pool.token1.symbol in this._tokenList)) {
          this._tokenList[pool.token1.symbol] = pool.token1;
        }
        if (!(pool.token2.symbol in this._tokenList)) {
          this._tokenList[pool.token2.symbol] = pool.token2;
        }
      }
    }
    this._ready = true;
  }

  public ready(): boolean {
    return this._ready;
  }

  public getPool(token1: string, token2: string): IConfigPool {
    let tokensKey = token1 + '-' + token2;
    if (token1 > token2) {
      tokensKey = token2 + '-' + token1;
    }
    const pool = this._pools[tokensKey];
    if (!pool) {
      throw new Error(
        `Plenty priceSwap: no trade pair found for ${token1} to ${token2}.`
      );
    }
    return pool;
  }

  public async poolFromPair(
    token1: string,
    token2: string,
    tezos: Tezos
  ): Promise<IPoolData> {
    const pool = this.getPool(token1, token2);
    const poolContract = await tezos.provider.contract.at(pool.address);
    return { config: pool, contract: poolContract };
  }

  public async ctezContract(tezos: Tezos): Promise<any> {
    return await tezos.provider.contract.at(this._ctezAdminAddress);
  }

  public get tokenList(): Record<string, IConfigToken> {
    return this._tokenList;
  }

  /**
   * Router address.
   */
  public get router(): string {
    return this._router;
  }

  /**
   * Gets the allowed slippage percent from the optional parameter or the value
   * in the configuration.
   *
   * @param allowedSlippageStr (Optional) should be of the form '1/10'.
   */
  public getAllowedSlippage(allowedSlippageStr?: string): string {
    if (allowedSlippageStr != null && isFractionString(allowedSlippageStr)) {
      const fractionSplit = allowedSlippageStr.split('/');
      if (fractionSplit[0] !== '0')
        return allowedSlippageStr;
      else
        return PlentyConfig.config.allowedSlippage;
    } else
      return PlentyConfig.config.allowedSlippage;
  }
}
