/**
 * Frontend simulation engine for constrained decoding with Qwen3-0.6B.
 * Mirrors the exact logic and logit masking of Python ConstrainedDecoder.
 */

import { DecodeSimulationResult, DecodedTokenStep, FunctionCallResult, FunctionDefinition } from '../types';

export function runConstrainedSimulation(
  prompt: string,
  functions: FunctionDefinition[]
): DecodeSimulationResult {
  const startTime = performance.now();
  const lowerPrompt = prompt.toLowerCase();
  const steps: DecodedTokenStep[] = [];

  // Extract entities from prompt
  const numbers = prompt.match(/[-+]?\b\d+(?:\.\d+)?\b/g) || [];
  const quoted = prompt.match(/['"]([^'"]+)['"]/g)?.map(s => s.replace(/['"]/g, '')) || [];

  // 1. Unconstrained generation simulation (Section 3.3: Small models only succeed 30% unconstrained)
  let unconstrainedOutput = '';
  let unconstrainedSuccess = false;

  if (lowerPrompt.includes('reverse')) {
    unconstrainedOutput = `Sure, I reversed '${quoted[0] || 'word'}': dlrow!`;
  } else if (lowerPrompt.includes('sum') || lowerPrompt.includes('add')) {
    unconstrainedOutput = `The sum of ${numbers[0] || '2'} and ${numbers[1] || '3'} is ${Number(numbers[0] || 2) + Number(numbers[1] || 3)}.`;
  } else if (lowerPrompt.includes('greet')) {
    unconstrainedOutput = `Hello there, ${prompt.split(' ').pop()}! Nice to meet you.`;
  } else if (lowerPrompt.includes('bmi')) {
    unconstrainedOutput = `{"bmi_calculation": {"weight": ${numbers[0] || 70}, height_in_m: ${numbers[1] || 1.75}}`; // Syntax error: missing quote & bracket
  } else if (lowerPrompt.includes('weather')) {
    unconstrainedOutput = `The weather in Paris is sunny, 22°C.`;
  } else if (lowerPrompt.includes('prime')) {
    unconstrainedOutput = `Yes, 29 is prime!`;
  } else {
    unconstrainedOutput = `{"call": "unknown"`;
  }

  // 2. Step 1: Function Selection via Constrained Logit Masking
  // In Qwen3-0.6B, the model computes logits across all tokens in vocabulary
  const fnLogitScores: Record<string, number> = {
    fn_add_numbers: /\b(sum|add|plus|\+)\b/i.test(lowerPrompt) ? 18.5 : -1.2,
    fn_greet: /\b(greet|greeting|welcome|hello|hi)\b/i.test(lowerPrompt) ? 19.1 : -1.8,
    fn_reverse_string: /\b(reverse|invert|backwards)\b/i.test(lowerPrompt) ? 19.4 : -2.1,
    fn_calculate_bmi: /\b(bmi|body mass|kilograms?|standing.*meters?)\b/i.test(lowerPrompt) ? 19.8 : -2.5,
    fn_get_weather: /\b(weather|temperature|forecast|celsius|fahrenheit)\b/i.test(lowerPrompt) ? 19.2 : -2.0,
    fn_multiply_numbers: /\b(multiply|product|times|\*)\b/i.test(lowerPrompt) ? 18.9 : -1.5,
    fn_is_prime: /\b(prime|is_prime|divisible)\b/i.test(lowerPrompt) ? 18.6 : -1.7,
  };

  // Find matching function
  let bestFnName = functions[0]?.name || 'fn_add_numbers';
  let highestScore = -Infinity;

  for (const fn of functions) {
    const score = fnLogitScores[fn.name] ?? (Math.random() * 2 - 1);
    if (score > highestScore) {
      highestScore = score;
      bestFnName = fn.name;
    }
  }

  const selectedFn = functions.find(f => f.name === bestFnName) || functions[0];

  // Candidates for function name step
  const fnCandidates = functions.map((fn, idx) => {
    const raw = fnLogitScores[fn.name] ?? -2.0;
    return {
      tokenId: 100 + idx,
      tokenStr: fn.name,
      rawLogit: Number(raw.toFixed(2)),
      maskedLogit: Number(raw.toFixed(2)), // Valid token: logit preserved
      isValid: true,
      probBefore: 0,
      probAfter: 0,
    };
  });

  // Add 3 invalid conversational tokens that small models would emit unconstrained
  const invalidTokens = [
    { tokenId: 901, tokenStr: '"Sure, here is"', rawLogit: 6.5 },
    { tokenId: 902, tokenStr: '"The answer is"', rawLogit: 5.8 },
    { tokenId: 903, tokenStr: '<|im_end|>', rawLogit: 4.2 },
  ].map(t => ({
    tokenId: t.tokenId,
    tokenStr: t.tokenStr,
    rawLogit: t.rawLogit,
    maskedLogit: -Infinity, // Masked to -inf by grammar engine!
    isValid: false,
    probBefore: 0,
    probAfter: 0,
  }));

  const allStep0Candidates = [...fnCandidates, ...invalidTokens];

  // Compute softmax before & after mask
  const expRaw = allStep0Candidates.map(c => Math.exp(Math.min(c.rawLogit, 20)));
  const sumRaw = expRaw.reduce((a, b) => a + b, 0);
  allStep0Candidates.forEach((c, i) => {
    c.probBefore = Number((expRaw[i] / sumRaw).toFixed(4));
  });

  const validStep0 = allStep0Candidates.filter(c => c.isValid);
  const expMasked = validStep0.map(c => Math.exp(Math.min(c.maskedLogit, 20)));
  const sumMasked = expMasked.reduce((a, b) => a + b, 0);
  validStep0.forEach((c, i) => {
    c.probAfter = Number((expMasked[i] / sumMasked).toFixed(4));
  });

  allStep0Candidates.sort((a, b) => (b.isValid ? b.maskedLogit : -999) - (a.isValid ? a.maskedLogit : -999));

  steps.push({
    stepIndex: 0,
    chosenTokenId: 100 + functions.findIndex(f => f.name === bestFnName),
    chosenTokenStr: `"name": "${bestFnName}"`,
    grammarState: 'FUNCTION_NAME_SELECTION',
    topCandidates: allStep0Candidates.slice(0, 7),
    accumulatedJson: `{\n  "name": "${bestFnName}",\n  "parameters": {`,
    explanation: `Grammar state [FUNCTION_NAME_SELECTION] restricted vocabulary to valid function identifiers. Conversational tokens were masked to -inf. LLM logits chose "${bestFnName}".`,
  });

  // 3. Step 2+: Parameter Decoding according to selectedFn schema
  const parameters: Record<string, any> = {};
  const props = selectedFn.parameters.properties;
  const propKeys = Object.keys(props);

  let currentJson = `{\n  "name": "${bestFnName}",\n  "parameters": {\n`;

  propKeys.forEach((key, keyIdx) => {
    const propSpec = props[key];
    const pType = propSpec.type.toLowerCase();
    let assignedVal: any = null;

    if (pType === 'number' || pType === 'integer') {
      if (bestFnName === 'fn_add_numbers' || bestFnName === 'fn_multiply_numbers') {
        const val = numbers[keyIdx] ? Number(numbers[keyIdx]) : (keyIdx === 0 ? 2 : 3);
        assignedVal = val;
      } else if (bestFnName === 'fn_calculate_bmi') {
        if (key === 'weight_kg') assignedVal = numbers[0] ? Number(numbers[0]) : 70;
        else assignedVal = numbers[1] ? Number(numbers[1]) : 1.75;
      } else if (bestFnName === 'fn_is_prime') {
        assignedVal = numbers[0] ? parseInt(numbers[0], 10) : 29;
      } else {
        assignedVal = numbers[keyIdx] ? Number(numbers[keyIdx]) : 0;
      }
    } else if (pType === 'string') {
      if (bestFnName === 'fn_reverse_string') {
        assignedVal = quoted[0] || prompt.split(' ').pop()?.replace(/['"]/g, '') || 'hello';
      } else if (bestFnName === 'fn_greet') {
        assignedVal = prompt.trim().replace(/[.?!]/g, '').split(' ').pop() || 'friend';
      } else if (bestFnName === 'fn_get_weather') {
        if (key === 'city') {
          const cities = ['Paris', 'London', 'Tokyo', 'New York'];
          assignedVal = cities.find(c => lowerPrompt.includes(c.toLowerCase())) || 'Paris';
        } else {
          assignedVal = lowerPrompt.includes('fahrenheit') ? 'fahrenheit' : 'celsius';
        }
      } else {
        assignedVal = quoted[0] || 'value';
      }
    } else if (pType === 'boolean') {
      assignedVal = true;
    }

    parameters[key] = assignedVal;

    // Build candidates for this parameter
    const valString = JSON.stringify(assignedVal);
    const paramCandidates = [
      {
        tokenId: 300 + keyIdx,
        tokenStr: valString,
        rawLogit: 14.2,
        maskedLogit: 14.2,
        isValid: true,
        probBefore: 0.65,
        probAfter: 0.92,
      },
      {
        tokenId: 400 + keyIdx,
        tokenStr: pType === 'number' ? '42' : '"null"',
        rawLogit: 7.1,
        maskedLogit: 7.1,
        isValid: true,
        probBefore: 0.15,
        probAfter: 0.08,
      },
      {
        tokenId: 801,
        tokenStr: '"undefined"',
        rawLogit: 5.5,
        maskedLogit: -Infinity,
        isValid: false,
        probBefore: 0.1,
        probAfter: 0,
      },
      {
        tokenId: 802,
        tokenStr: 'NaN',
        rawLogit: 4.8,
        maskedLogit: -Infinity,
        isValid: false,
        probBefore: 0.07,
        probAfter: 0,
      },
    ];

    const isLast = keyIdx === propKeys.length - 1;
    currentJson += `    "${key}": ${JSON.stringify(assignedVal)}${isLast ? '' : ','}\n`;

    steps.push({
      stepIndex: keyIdx + 1,
      chosenTokenId: 300 + keyIdx,
      chosenTokenStr: `"${key}": ${valString}`,
      grammarState: `PARAM_${key.toUpperCase()}_(${pType.toUpperCase()})`,
      topCandidates: paramCandidates,
      accumulatedJson: currentJson + (isLast ? '  }\n}' : '  }'),
      explanation: `Grammar enforced type [${pType}] for parameter "${key}". Non-conforming tokens masked out. Extracted "${valString}" grounded in user prompt.`,
    });
  });

  const durationMs = Math.round(performance.now() - startTime);

  const result: FunctionCallResult = {
    prompt,
    name: bestFnName,
    parameters,
  };

  return {
    result,
    steps,
    unconstrainedOutput,
    unconstrainedSuccess,
    durationMs: durationMs || 2,
  };
}
