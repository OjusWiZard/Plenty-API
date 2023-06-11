# Plenty swap transaction
This repository demonstrates how to make a swap transaction on Plenty.

## Why does it help?
It recreates this issue [#1690](https://github.com/ecadlabs/taquito/issues/1690) in Taquito at every run on mainnet.

# How to run?
1. Install dependencies using the command `yarn`.
2. Install `ts-node` using
```
npm install -g ts-node
```
3. Add your wallet's private key and address in `./wallet.json`. And, fill your wallet with some XTZ.
4. Start the script using
```
ts-node src/index.ts
```
The script will try to buy some `DOGA` using `XTZ`, and then fail with the error `Confirmation polling timed out`.