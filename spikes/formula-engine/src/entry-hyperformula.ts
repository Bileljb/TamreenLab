// Bundle-size entry point: the adapter plus everything it pulls in.
import { hyperFormulaEngine } from './hyperformula-engine';

export const result = hyperFormulaEngine.evaluate({ A1: 1, A2: 2 }, '=SUM(A1:A2)');
