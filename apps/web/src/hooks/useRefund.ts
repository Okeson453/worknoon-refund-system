import { useCallback, useState } from 'react';
import { submitRefundRequest } from '../services/refunds';
import { ApiRequestError } from '../services/api';
import { useDevSession } from '../dev/SessionContext';
import { reasonCodeLabel } from '../utils/status';
import type {
  CreateRefundRequestInput,
  CreateRefundResponse,
  RefundSubmissionState,
} from '../types/refund';

export interface UseRefundResult {
  state: RefundSubmissionState;
  result: CreateRefundResponse | null;
  error: { message: string; requestId: string | null; fieldErrors: Array<{ path: string; message: string }> } | null;
  submit: (input: CreateRefundRequestInput) => Promise<CreateRefundResponse | null>;
  reset: () => void;
}

export function useRefund(): UseRefundResult {
  // Null in production; feeds the dev overlay so the on-screen verdict can never drift from the API.
  const devSession = useDevSession();
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
      devSession?.reportDecision({
        decision: response.decision,
        amountCents: response.refundAmountCents,
        reference: response.id,
        reasons: response.reasonCodes.map((code) => reasonCodeLabel(code)),
        message: response.customerMessage,
      });
      return response;
    } catch (cause) {
      if (cause instanceof ApiRequestError) {
        setError({ message: cause.message, requestId: cause.requestId, fieldErrors: cause.details });
        devSession?.reportBlocked({ message: cause.message });
      } else {
        setError({ message: 'Something went wrong while submitting the request.', requestId: null, fieldErrors: [] });
      }
      setState('error');
      return null;
    }
  }, [devSession]);

  const reset = useCallback(() => {
    setState('idle');
    setResult(null);
    setError(null);
  }, []);

  return { state, result, error, submit, reset };
}
