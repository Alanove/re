import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { Snackbar } from 'react-native-paper';

interface FeedbackContextValue {
  showMessage: (message: string) => void;
}

const FeedbackContext = createContext<FeedbackContextValue>({ showMessage: () => undefined });

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const showMessage = useCallback((text: string) => setMessage(text), []);
  const value = useMemo(() => ({ showMessage }), [showMessage]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage(null)} duration={4000}>
        {message || ''}
      </Snackbar>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  return useContext(FeedbackContext);
}
