import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OnChainDashboard from './components/OnChainDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="App">
        <OnChainDashboard />
      </div>
    </QueryClientProvider>
  );
}

export default App;