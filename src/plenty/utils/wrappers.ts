import BigNumber from "bignumber.js";
import { ICalculateTokenResponse, IRouterResponse, ISwapDataResponse, PoolType } from "../plenty.types";
import { calculateTokenOutputVolatile, calculateTokensOutGeneralStable, calculateTokensOutTezCtez } from "./pricing";
import { loadSwapDataGeneralStable, loadSwapDataTezCtez, loadSwapDataTezPairs, loadSwapDataVolatile } from "./swapdata";
import { allPaths, computeAllPaths } from "./paths";
import { routerSwap } from "./router";
import { WalletParamsWithKind } from "@taquito/taquito";
import { Plenty } from "../plenty";
import { Tezos } from "../../tezos/tezos";


export const calculateTokensOutWrapper = (
  plenty: Plenty,
  tokenInAmount: BigNumber,
  exchangefee: BigNumber,
  slippage: string,
  tokenIn: string,
  tokenOut: string,
  tokenInSupply: BigNumber,
  tokenOutSupply: BigNumber,
  tokenInPrecision?: BigNumber,
  tokenOutPrecision?: BigNumber,
  target?: BigNumber
): ICalculateTokenResponse => {
  try {
    const poolConfig = plenty.getPool(tokenIn, tokenOut);
    const type = poolConfig.type;
    let tokenInConfig = plenty.getTokenBySymbol(tokenIn);
    let tokenOutConfig = plenty.getTokenBySymbol(tokenOut);

    let outputData: ICalculateTokenResponse;

    if ((type === PoolType.VOLATILE || type === PoolType.TEZ) && tokenInSupply && tokenOutSupply) {
      outputData = calculateTokenOutputVolatile(
        tokenInAmount,
        tokenInSupply,
        tokenOutSupply,
        exchangefee,
        slippage,
        tokenOutConfig,
      );
    } else {
      if (tokenInConfig.symbol === "XTZ" && tokenOutConfig.symbol === "CTez" && target) {
        outputData = calculateTokensOutTezCtez(
          tokenInSupply,
          tokenOutSupply,
          tokenInAmount,
          exchangefee,
          slippage,
          target,
          tokenInConfig.symbol
        );
      } else if (tokenInConfig.symbol === "CTez" && tokenOutConfig.symbol === "XTZ" && target) {
        outputData = calculateTokensOutTezCtez(
          tokenOutSupply,
          tokenInSupply,
          tokenInAmount,
          exchangefee,
          slippage,
          target,
          tokenInConfig.symbol
        );
      } else if (tokenInSupply && tokenOutSupply && tokenInPrecision && tokenOutPrecision) {
        outputData = calculateTokensOutGeneralStable(
          tokenInSupply,
          tokenOutSupply,
          tokenInAmount,
          exchangefee,
          slippage,
          tokenInConfig,
          tokenOutConfig,
          tokenInPrecision,
          tokenOutPrecision
        );
      } else {
        throw new Error("Plenty priceSwapOut: Invalid Parameter");
      }
    }

    return outputData;
  } catch (error) {
    return {
      tokenOutAmount: new BigNumber(0),
      fees: new BigNumber(0),
      feePerc: new BigNumber(0),
      minimumOut: new BigNumber(0),
      exchangeRate: new BigNumber(0),
      priceImpact: new BigNumber(0),
      error,
    };
  }
};

export const loadSwapDataWrapper = async (
  tezos: Tezos,
  plenty: Plenty,
  tokenIn: string,
  tokenOut: string
): Promise<ISwapDataResponse> => {
  try {
    const dex = await plenty.poolFromPair(tokenIn, tokenOut, tezos);
    const dexType = dex.config.type;

    let fullTokenIn = plenty.getTokenBySymbol(tokenIn);
    let fullTokenOut = plenty.getTokenBySymbol(tokenOut);

    let swapData: ISwapDataResponse;
    if (dexType === PoolType.TEZ) {
      swapData = await loadSwapDataTezPairs(dex, fullTokenIn, fullTokenOut);
    } else if (dexType === PoolType.VOLATILE) {
      swapData = await loadSwapDataVolatile(dex, fullTokenIn, fullTokenOut);
    } else {
      if (
        (tokenIn === "XTZ" && tokenOut === "CTez") ||
        (tokenIn === "CTez" && tokenOut === "XTZ")
      ) {
        const ctez = await plenty.ctezContract(tezos);
        swapData = await loadSwapDataTezCtez(dex, ctez, tokenIn, tokenOut);
      } else {
        swapData = await loadSwapDataGeneralStable(dex, fullTokenIn, fullTokenOut);
      }
    }
    return swapData;
  } catch (error) {
    return {
      success: false,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      tokenInSupply: new BigNumber(0),
      tokenOutSupply: new BigNumber(0),
      exchangeFee: new BigNumber(0),
      lpTokenSupply: new BigNumber(0),
      lpToken: undefined,
    };
  }
};

export const computeAllPathsWrapper = (
  plenty: Plenty,
  paths: string[],
  tokenInAmount: BigNumber,
  slippage: string = '1/100',
  swapData: ISwapDataResponse[][],
): IRouterResponse => {
  try {
    const bestPath = computeAllPaths(
      plenty,
      paths,
      tokenInAmount,
      slippage,
      swapData
    );

    const isStable: boolean[] = [];
    let finalPriceImpact = new BigNumber(0);
    let finalFeePerc = new BigNumber(0);

    for (var x of bestPath.priceImpact) {
      finalPriceImpact = finalPriceImpact.plus(x);
    }

    for (var y of bestPath.feePerc) {
      finalFeePerc = finalFeePerc.plus(y);
    }

    for (var z = 0; z < bestPath.path.length - 1; z++) {
      const dexType = plenty.getPool(bestPath.path[z], bestPath.path[z + 1]).type;
      if (dexType === PoolType.STABLE) isStable.push(true);
      else isStable.push(false);
    }

    const exchangeRate = bestPath.tokenOutAmount.dividedBy(tokenInAmount);

    return {
      path: bestPath.path,
      tokenOutAmount: bestPath.tokenOutAmount,
      finalMinimumTokenOut: bestPath.minimumTokenOut[bestPath.minimumTokenOut.length - 1],
      minimumTokenOut: bestPath.minimumTokenOut,
      finalPriceImpact: finalPriceImpact,
      finalFeePerc: finalFeePerc,
      feePerc: bestPath.feePerc,
      isStable: isStable,
      exchangeRate: exchangeRate,
    };
  } catch (error) {
    return {
      path: [],
      tokenOutAmount: new BigNumber(0),
      finalMinimumTokenOut: new BigNumber(0),
      minimumTokenOut: [],
      finalPriceImpact: new BigNumber(0),
      finalFeePerc: new BigNumber(0),
      feePerc: [],
      isStable: [],
      exchangeRate: new BigNumber(0),
    };
  }
};

export const swapWrapper = async (
  tezos: Tezos,
  plenty: Plenty,
  tokenIn: string,
  tokenOut: string,
  tokenInAmount: BigNumber,
  caller: string,
  slippage?: string
): Promise<WalletParamsWithKind[]> => {

  const paths = await allPaths(
    tezos,
    plenty,
    tokenIn,
    tokenOut,
    true
  );

  const path = computeAllPathsWrapper(
    plenty,
    paths.paths,
    tokenInAmount,
    slippage,
    paths.swapData,
  );

  return await routerSwap(
    tezos,
    plenty,
    path.path,
    path.minimumTokenOut,
    caller,
    caller,
    tokenInAmount
  )
};