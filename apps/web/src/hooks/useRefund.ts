import { useCallback, useState } from 'react';
import { submitRefundRequest } from '../services/refunds';
import { ApiRequestError } from '../services/api';
import type { CreateRefundRequestInput, CreateRefundResponse, RefundSubmissionState } from '../types/refund';

export interface UseRefundResult {
  state: RefundSubmissionState;
  result: CreateRefundResponse | null;
  error: { message: string; requestId: string | null; fieldErrors: Array<{ path: string; message: string }> } | null;
  submit: (input: CreateRefundRequestInput) => Promise<CreateRefundResponse | null>;
  reset: () => void;
}

export function useRefund(): UseRefundResult {
  const [state, setState] = useState<RefundSubmissionState>('idle');
  const [result, setResult] = useState<CreateRefundResponse | null>(null);
  const [error, setError] = useState<UseRefundResult['error']>(null);

  const submit = useCallback(async (input: CreateRefundRequestInput): Promise<CreateRefundResponse | null> => {
    setState('validating');
    setError(null);
    setResult(null);

    // The backend is the only authority; the delay keeps the validating state observable.
    await new Promise((resolve) => window.setTimeout(resolve, 150));
    setState('submitting');

    try {
      const response = await submitRefundRequest(input);
      setResult(response);
      setState('success');
      return response;
    } catch (cause) {
      if (cause instanceof ApiRequestError) {
        setError({ message: cause.message, requestId: cause.requestId, fieldErrors: cause.details });
      } else {
        setError({ message: 'Something went wrong while submitting the request.', requestId: null, fieldErrors: [] });
      }
      setState('error');
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setResult(null);
    setError(null);
  }, []);

  return { state, result, error, submit, reset };
}
