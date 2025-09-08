# Live Price Quotes Dashboard

Live DEX price comparison tool for $10K token swaps. Built to analyze protocol performance against competitors.

## Features

- **Real-time Price Rankings**: Compare execution prices across DEX protocols
- **Single-hop Focus**: Only direct swaps, no complex multi-hop routing  
- **$10K USD Swaps**: Realistic trading amounts for institutional comparison
- **6 Major Pairs**: WETH-USDT, WBTC-USDC, UNI-ETH, WETH-USDC, USDC-DAI, USDe-USDT
- **24h Historical Charts**: Track ranking changes and competitive gaps
- **Protocol Analysis**: Identify where Uniswap leads or needs improvement

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Data**: On-chain quotes + 0x API integration
- **Charts**: Recharts for 24h historical visualization
- **Database**: SQLite for historical data storage
- **Deployment**: Vite build system

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Alchemy API key ([Get here](https://www.alchemy.com/))
- 0x API key ([Get here](https://0x.org/docs/api))

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd uniswap-price-quotes
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your API keys:
   ```env
   ALCHEMY_API_KEY=your_alchemy_api_key_here
   VITE_ALCHEMY_API_KEY=your_alchemy_api_key_here
   ZEROX_API_KEY=your_0x_api_key_here
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:5173
   ```

### Production Build

```bash
npm run build
npm run preview
```

## API Configuration

The app requires two API services:

### Alchemy (Ethereum RPC)
- Sign up at [alchemy.com](https://www.alchemy.com/)
- Create a new app for Ethereum Mainnet
- Copy your API key to `ALCHEMY_API_KEY` and `VITE_ALCHEMY_API_KEY`

### 0x Protocol
- Sign up at [0x.org](https://0x.org/docs/api)
- Get your API key from the dashboard
- Add to `ZEROX_API_KEY` in your `.env` file

## Architecture

- **Frontend**: React app with TypeScript and Tailwind CSS
- **Data Sources**: Direct on-chain queries via Alchemy + 0x API for aggregated quotes
- **Quote Sources**: Uniswap V2, V3, V4, Sushiswap, Curve, 0x aggregation
- **Update Frequency**: Real-time quotes with 30-second refresh cycles
- **Data Storage**: Local SQLite for historical price tracking

## Supported DEX Protocols

- Uniswap V2, V3, V4
- Sushiswap
- Curve Finance 
- Balancer (quotes for Balancer need improvements) 
- 0x Protocol Aggregation (Matcha)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT open source license for community use
