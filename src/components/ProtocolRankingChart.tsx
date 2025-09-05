import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { HistoricalData } from '../types/api';

interface ProtocolRankingChartProps {
  historicalData: HistoricalData[];
  pairName: string;
}

interface ChartDataPoint {
  timestamp: number;
  time: string;
  [protocol: string]: number | string;
}

export const ProtocolRankingChart: React.FC<ProtocolRankingChartProps> = ({
  historicalData,
  pairName
}) => {
  // Transform historical data for the chart
  const chartData: ChartDataPoint[] = historicalData.map(data => {
    const dataPoint: ChartDataPoint = {
      timestamp: data.timestamp,
      time: new Date(data.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
    };

    // Add each protocol's rank as a property
    data.rankings.forEach(ranking => {
      dataPoint[ranking.protocol.replace('_', ' ')] = ranking.rank;
    });

    return dataPoint;
  });

  // Get all unique protocols from the data
  const allProtocols = Array.from(
    new Set(
      historicalData.flatMap(data => 
        data.rankings.map(r => r.protocol.replace('_', ' '))
      )
    )
  );

  // Color palette for different protocols
  const protocolColors = [
    '#FF007A', // Uniswap pink
    '#2172E5', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#8B5CF6', // Purple
    '#EF4444', // Red
    '#06B6D4', // Cyan
    '#84CC16', // Lime
  ];

  const getProtocolColor = (protocol: string, index: number) => {
    // Special colors for Uniswap protocols
    if (protocol.includes('Uniswap')) return '#FF007A';
    return protocolColors[index % protocolColors.length];
  };

  if (historicalData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          {pairName} - 24h Protocol Ranking History
        </h3>
        <div className="text-center py-8 text-gray-500">
          No historical data available yet. Data will appear after first collection cycle.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          {pairName} - 24h Protocol Ranking History
        </h3>
        <div className="text-sm text-gray-500">
          {historicalData.length} data points
        </div>
      </div>

      <div className="mb-4 text-sm text-gray-600">
        <p>Lower rank numbers = better execution prices. Watch for ranking changes and competitive gaps.</p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="time" 
            stroke="#6b7280"
            fontSize={12}
          />
          <YAxis 
            stroke="#6b7280"
            fontSize={12}
            domain={[1, 'dataMax']}
            tickCount={Math.min(allProtocols.length + 1, 6)}
            label={{ value: 'Rank', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '6px'
            }}
            labelFormatter={(value) => `Time: ${value}`}
            formatter={(value: any, name: string) => [
              `#${value}`, 
              name
            ]}
          />
          <Legend />
          
          {allProtocols.map((protocol, index) => (
            <Line
              key={protocol}
              type="monotone"
              dataKey={protocol}
              stroke={getProtocolColor(protocol, index)}
              strokeWidth={protocol.includes('Uniswap') ? 3 : 2}
              dot={{ r: protocol.includes('Uniswap') ? 4 : 3 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Protocol Performance Summary */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {allProtocols.slice(0, 4).map((protocol, index) => {
          const latestRanking = historicalData[historicalData.length - 1]?.rankings
            .find(r => r.protocol.replace('_', ' ') === protocol);
          
          const earliestRanking = historicalData[0]?.rankings
            .find(r => r.protocol.replace('_', ' ') === protocol);

          if (!latestRanking || !earliestRanking) return null;

          const rankChange = earliestRanking.rank - latestRanking.rank;
          const changeColor = rankChange > 0 ? 'text-green-600' : rankChange < 0 ? 'text-red-600' : 'text-gray-600';
          const changeIcon = rankChange > 0 ? '↗️' : rankChange < 0 ? '↘️' : '→';

          return (
            <div key={protocol} className="text-center p-2 bg-gray-50 rounded">
              <p className="text-xs font-medium text-gray-800 truncate">{protocol}</p>
              <p className="text-lg font-bold" style={{ color: getProtocolColor(protocol, index) }}>
                #{latestRanking.rank}
              </p>
              <p className={`text-xs ${changeColor}`}>
                {changeIcon} {rankChange > 0 ? '+' : ''}{rankChange}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};