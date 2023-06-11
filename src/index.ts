import { readFileSync } from 'fs';
import { routerSwap } from './plenty/utils/router';
import { allPaths } from './plenty/utils/paths';
import { computeAllPathsWrapper } from './plenty/utils/wrappers';
import { Tezos } from './tezos/tezos';
import { Plenty } from './plenty/plenty';
import BigNumber from 'bignumber.js';


const swap = async (
    address: string,
    base: string,
    quote: string,
    amount: BigNumber,
    side: string,
    allowedSlippage?: string
) => {
    const tezos = new Tezos();
    const plenty = new Plenty();
    await tezos.init();
    await plenty.init();

    const baseToken = plenty.getTokenBySymbol(base);
    const quoteToken = plenty.getTokenBySymbol(quote);
    let tokenIn = quote;
    let tokenOut = base;
    let swapAmount = new BigNumber(amount).dividedBy(new BigNumber(10).pow(quoteToken.decimals));
    if (side === 'BUY') {
        tokenIn = base;
        tokenOut = quote;
        swapAmount = new BigNumber(amount).dividedBy(new BigNumber(10).pow(baseToken.decimals));
    }

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
        swapAmount,
        plenty.getAllowedSlippage(allowedSlippage),
        paths.swapData,
    );

    const swapParams = await routerSwap(
        tezos,
        plenty,
        path.path,
        path.minimumTokenOut,
        address,
        address,
        amount,
    )

    const batch = tezos.provider.wallet.batch(swapParams);
    const batchOp = await batch.send();
    await batchOp.confirmation();
    const status = await batchOp.status();
    if (status === "applied") {
        return {
            hash: batchOp.opHash,
            operations: await batchOp.operationResults()
        };
    } else {
        throw new Error('Plenty: trade failed' + status);
    }
}


(async () => {
    const walletData = JSON.parse(readFileSync('./wallet.json', 'utf8'));
    const res = await swap(
        walletData.address,
        'XTZ',
        'DOGA',
        new BigNumber(100000),
        'BUY',
    )
    console.log(res);
})();