import { solveRange, type ChallengeData } from './solver';

interface WorkerScope {
  onmessage: ((event: MessageEvent<ChallengeData>) => void) | null;
  postMessage(message: unknown): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const data = event.data;
  const found = solveRange(data, 0, data.maxNumber);
  scope.postMessage(found === null ? { error: 'not-found' } : { number: found, attempts: found + 1 });
};
