import { Alert } from 'react-native';
import { authedFetch } from '../services/api/authedFetch';

// The backend 403s with detail "KYC_REQUIRED" in two places, not one:
//   • withdrawals            (wallet service)
//   • opening a LIVE account (account_service.py — demo accounts are exempt)
// Registering, depositing and trading an existing account all work unverified.
//
// Both cases must surface as the gate dialog below. Showing the raw
// "KYC_REQUIRED" token to the user (which is what the Accounts screen used to
// do) is meaningless to them and reads like a crash.

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

/** True when a thrown API error is the backend's KYC_REQUIRED 403. */
export function isKycRequiredError(err) {
  return /KYC_REQUIRED/i.test(String(err?.message ?? err ?? ''));
}

const GATE_COPY = {
  withdraw: {
    title: 'Complete KYC to withdraw',
    message:
      'Deposits and trading work without verification, but withdrawals require ' +
      'approved KYC. Complete your identity verification and your withdrawal ' +
      'will go through once it is approved.',
  },
  account: {
    title: 'Complete KYC to open a live account',
    message:
      'Live trading accounts require approved KYC. You can keep using a demo ' +
      'account meanwhile — complete your identity verification and you can open ' +
      'a live account as soon as it is approved.',
  },
};

// KYC gate dialog. The Kyc screen lives in the HomeTab stack, so this
// navigates cross-tab and works from Funds and Accounts alike.
export function showKycGate(navigation, kind = 'withdraw') {
  const copy = GATE_COPY[kind] || GATE_COPY.withdraw;
  Alert.alert(copy.title, copy.message, [
    { text: 'Later', style: 'cancel' },
    {
      text: 'Complete KYC',
      onPress: () => navigation?.navigate?.('HomeTab', { screen: 'Kyc' }),
    },
  ]);
}

/** Back-compat wrapper for the withdraw screens. */
export function showWithdrawKycGate(navigation) {
  showKycGate(navigation, 'withdraw');
}
