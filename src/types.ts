/**
 * TypeScript interfaces mirroring the Python Pydantic models.
 */

export interface ParameterProperty {
  type: string;
  description?: string;
}

export interface ParametersSchema {
  type: string;
  properties: Record<string, ParameterProperty>;
  required: string[];
}

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: ParametersSchema;
  returns?: {
    type: string;
    description?: string;
  };
}

export interface CandidateLogit {
  tokenId: number;
  tokenStr: string;
  rawLogit: number;
  maskedLogit: number;
  isValid: boolean;
  probBefore: number;
  probAfter: number;
}

export interface DecodedTokenStep {
  stepIndex: number;
  chosenTokenId: number;
  chosenTokenStr: string;
  grammarState: string;
  topCandidates: CandidateLogit[];
  accumulatedJson: string;
  explanation: string;
}

export interface FunctionCallResult {
  prompt: string;
  name: string;
  parameters: Record<string, any>;
}

export interface DecodeSimulationResult {
  result: FunctionCallResult;
  steps: DecodedTokenStep[];
  unconstrainedOutput: string;
  unconstrainedSuccess: boolean;
  durationMs: number;
}
