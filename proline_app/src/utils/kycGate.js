import { Alert } from 'react-native';
import { authedFetch } from '../services/api/authedFetch';

// Mirrors the web trader app: everything (registering, depositing, trading,
// opening live accounts) works without KYC. Identity is verified at
// WITHDRAWAL time only — the backend 403s with detail "KYC_REQUIRED" when a
// withdrawal is requested by an unverified user, and the withdraw screens
// show the gate dialog below.

export function isKycApproved(status) {
  const v = String(status || '').toLowerCase();
  return v === 'approved' || v === 'verified';
}

export function kycStatusLabel(status) {
  const v = String(status || '').toLowerCase();
  if (v === 'unknown') return 'Status unavailable';
  if (!v || v === 'pending' || v === 'none') return 'Not started';
  if (v === 'submitted' || v === 'under_review') return 'Under review';
  if (v === 'rejected' || v === 'failed') return 'Rejected — please resubmit';
  if (v === 'approved' || v === 'verified') return 'Approved';
  return v;
}

// Fetch the current user's KYC status from /profile. Returns the raw string
// (lowercased) — caller can pass it through isKycApproved(). Returns the
// 'unknown' sentinel when the request FAILS (network error / non-2xx): the
// gate still stays closed (isKycApproved('unknown') is false), but callers
// must not present it as "Not started" — a verified user with a flaky
// connection isn't unverified. 'none' means the server really reported no KYC.
export async function fetchKycStatus() {
  try {
    const res = await authedFetch('/profile');
    if (!res.ok) return 'unknown';
    const data = await res.json().catch(() => ({}));
    return String(data?.kyc_status || 'none').toLowerCase();
  } catch (_) {
    return 'unknown';
  }
}

// Withdrawal-time KYC dialog. Shown when a withdrawal request comes back
// with the backend's 403 "KYC_REQUIRED". The Kyc screen lives in the
// HomeTab stack, so navigate cross-tab from the Funds screens.
export function showWithdrawKycGate(navigation) {
  Alert.alert(
    'Complete KYC to withdraw',
    'Deposits and trading work without verification, but withdrawals require ' +
      'approved KYC. Complete your identity verification and your withdrawal ' +
      'will go through once it is approved.',
    [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Complete KYC',
        onPress: () => navigation?.navigate?.('HomeTab', { screen: 'Kyc' }),
      },
    ],
  );
}
