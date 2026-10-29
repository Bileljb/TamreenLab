// Bundle-size entry point: the adapter plus everything it pulls in.
import { customEngine } from './custom';

export const result = customEngine.evaluate({ A1: 1, A2: 2 }, '=SUM(A1:A2)');
