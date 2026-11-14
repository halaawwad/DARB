import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { financeRepository } from './repository';
import { useQueryClient } from '@tanstack/react-query';
export function useFinance() {
  const snapshot = useSyncExternalStore(
    financeRepository.subscribe,
    financeRepository.getSnapshot,
    financeRepository.getSnapshot,
  );
  useEffect(() => {
    void financeRepository.init();
  }, []);
  return snapshot;
}
export function FinanceSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    void financeRepository.init().then(() => financeRepository.sync());
    const network = NetInfo.addEventListener((state) =>
      financeRepository.setOnline(state.isConnected !== false && state.isInternetReachable !== false),
    );
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') void financeRepository.sync();
    });
    const timer = setInterval(() => void financeRepository.sync(), 30000);
    let previous = financeRepository.getSnapshot().state;
    const unsubscribe = financeRepository.subscribe(() => {
      const next = financeRepository.getSnapshot().state;
      if (next !== previous) {
        previous = next;
        void queryClient.invalidateQueries({ queryKey: ['customers'] });
        void queryClient.invalidateQueries({ queryKey: ['ledger'] });
        void queryClient.invalidateQueries({ queryKey: ['orders'] });
      }
    });
    return () => {
      network();
      app.remove();
      clearInterval(timer);
      unsubscribe();
    };
  }, [queryClient]);
  return null;
}
