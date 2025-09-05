// 0x API Types
export interface ZeroXQuoteResponse {
  allowanceTarget: string;
  blockNumber: string;
  buyAmount: string;
  buyToken: string;
  fees: {
    integratorFee: any;
    zeroExFee: {
      amount: string;
      token: string;
      type: string;
    };
    gasFee: any;
  };
  gas: string;
  gasPrice: string;
  liquidityAvailable: boolean;
  minBuyAmount: string;
  route: {
    fills: ZeroXFill[];
    tokens: ZeroXToken[];
  };
  sellAmount: string;
  sellToken: string;
  tokenMetadata: {
    buyToken: {
      buyTaxBps: string;
      sellTaxBps: string;
    };
    sellToken: {
      buyTaxBps: string;
      sellTaxBps: string;
    };
  };
  totalNetworkFee: string;
  zid: string;
}

export interface ZeroXFill {
  from: string;
  to: string;
  source: string;
  proportionBps: string;
}

export interface ZeroXToken {
  address: string;
  symbol: string;
}

// App Types
export interface TokenPair {
  id: string;
  name: string;
  sellToken: {
    symbol: string;
    address: string;
    decimals: number;
  };
  buyToken: {
    symbol: string;
    address: string;
    decimals: number;
  };
  sellAmount: string; // $10K USD equivalent
}

export interface ProtocolRanking {
  protocol: string;
  totalProportion: number;
  effectiveRate: number;
  rank: number;
}

export interface PairQuote {
  pair: TokenPair;
  timestamp: number;
  totalBuyAmount: string;
  minBuyAmount: string;
  rankings: ProtocolRanking[];
  singleHopFills: ZeroXFill[];
}

export interface HistoricalData {
  timestamp: number;
  pairId: string;
  rankings: ProtocolRanking[];
}