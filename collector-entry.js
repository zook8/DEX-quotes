// Entry point for the data collector service
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Simple data collector that can run independently
console.log('Starting Uniswap Price Quotes Data Collector...');
console.log('Environment:', process.env.NODE_ENV);
console.log('API Key:', process.env.ZERO_EX_API_KEY ? 'Set' : 'Not set');

// Create collector script
const collectorScript = `
const { dataCollector } = require('./src/services/dataCollector');

console.log('Data collector service starting...');

// Start the data collector
dataCollector.start().then(() => {
  console.log('Data collector started successfully');
}).catch((error) => {
  console.error('Failed to start data collector:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down data collector...');
  dataCollector.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down data collector...');
  dataCollector.stop();
  process.exit(0);
});
`;

// Write the collector script
fs.writeFileSync('collector.js', collectorScript);

// Run with ts-node
const child = spawn('npx', ['ts-node', 'collector.js'], {
  stdio: 'inherit',
  env: { ...process.env }
});

child.on('error', (error) => {
  console.error('Collector process error:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log(`Collector process exited with code ${code}`);
  process.exit(code);
});

// Handle signals
process.on('SIGINT', () => {
  console.log('Terminating collector...');
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Terminating collector...');
  child.kill('SIGTERM');
});