import { API_URL } from '../../constants';
import * as SecureStore from 'expo-secure-store';
import { refreshAccessToken, notifyAuthFailure } from './authedFetch';
import { toMessage } from '../../utils/errorMessage';
import logger from '../../utils/logger';

class ApiService {
  constructor() {
    this.baseUrl = API_URL;
  }

  async getAuthHeaders(tokenOverride) {
    const token = tokenOverride ?? await SecureStore.getItemAsync('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  async _attempt(endpoint, options, tokenOverride) {
    const headers = await this.getAuthHeaders(tokenOverride);
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });
    // Parse body once; many backend errors include JSON detail.
    let data;
    try { data = await response.json(); } catch (_) { data = null; }
    return { response, data };
  }

  async request(endpoint, options = {}) {
    try {
      let { response, data } = await this._attempt(endpoint, options);

      // Try a refresh-token exchange once on auth failures.
      if (response.status === 401 || response.status === 403) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          ({ response, data } = await this._attempt(endpoint, options, newToken));
        }
        // Still unauthorised after the retry (or the refresh could not run):
        // the session is unusable. Surfacing the gateway's raw wording put
        // "Token expired" on the screen as if it were a feature error and left
        // the user on a dead screen, so hand it to the auth-failure handler —
        // which drops in-memory auth and lands them on the login screen.
        if (response.status === 401 || response.status === 403) {
          notifyAuthFailure();
          const err = new Error('Your session has expired. Please sign in again.');
          err.status = response.status;
          err.isAuthExpiry = true;
          throw err;
        }
      }

      if (!response.ok) {
        const err = new Error(toMessage(data, `Request failed (${response.status})`));
        err.status = response.status;
        throw err;
      }

      return data;
    } catch (error) {
      // 4xx responses are expected business rejections (validation, market
      // closed, insufficient margin…) that the calling screen surfaces itself —
      // logging them as errors floods dev LogBox with red boxes. Only network
      // failures and 5xx are genuinely unexpected.
      if (!(error.status >= 400 && error.status < 500)) {
        logger.error('API Request Error:', error);
      }
      throw error;
    }
  }

  // Portfolio APIs
  async getPortfolioSummary(accountId = null) {
    const query = accountId ? `?account_id=${accountId}` : '';
    return this.request(`/portfolio/summary${query}`);
  }

  async getPortfolioPerformance(period = 'all') {
    return this.request(`/portfolio/performance?period=${period}`);
  }

  async getTradeHistory(accountId = null, page = 1, perPage = 50) {
    const q = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (accountId) q.append('account_id', accountId);
    return this.request(`/portfolio/trades?${q.toString()}`);
  }

  // Wallet APIs
  async getWalletSummary() {
    return this.request('/wallet/summary');
  }

  async getDeposits(page = 1, perPage = 20) {
    return this.request(`/wallet/deposits?page=${page}&per_page=${perPage}`);
  }

  async getWithdrawals(page = 1, perPage = 20) {
    return this.request(`/wallet/withdrawals?page=${page}&per_page=${perPage}`);
  }

  async submitDeposit(data) {
    return this.request('/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async submitWithdrawal(data) {
    return this.request('/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Wallet — extended payment gateway methods

  async getDepositBankDetails() {
    return this.request('/wallet/deposit/bank-details', { method: 'POST' });
  }

  // Admin's active crypto (USDT/TRC20 etc.) deposit wallet — the destination
  // the website's USDT tab shows. { available, asset, network, wallet_address,
  // qr_code_url }.
  async getDepositCryptoDetails() {
    return this.request('/wallet/deposit/crypto-details');
  }

  // OxaPay automated crypto gateway. Goes through the generic /wallet/deposit
  // route with method:"oxapay"; backend returns a hosted payment_url to open.
  async createOxapayDeposit({ amount, accountId = null, cryptoCurrency = null } = {}) {
    const body = { amount: Number(amount), method: 'oxapay' };
    if (accountId) body.account_id = accountId;
    if (cryptoCurrency) body.crypto_currency = cryptoCurrency;
    return this.request('/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }


  async submitManualDeposit(formData) {
    const token = await SecureStore.getItemAsync('token');
    const res = await fetch(`${this.baseUrl}/wallet/deposit/manual`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
        'Accept': 'application/json',
      },
      body: formData,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(toMessage(data, `Manual deposit failed (${res.status})`));
    return data;
  }

  async submitManualWithdrawal(formData) {
    const token = await SecureStore.getItemAsync('token');
    const res = await fetch(`${this.baseUrl}/wallet/withdraw/manual`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
        'Accept': 'application/json',
      },
      body: formData,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(toMessage(data, `Manual withdrawal failed (${res.status})`));
    return data;
  }

  async getTransactions({ page = 1, perPage = 50, type = null } = {}) {
    const q = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (type) q.append('type', type);
    return this.request(`/wallet/transactions?${q.toString()}`);
  }

  // Social Trading APIs
  async getLeaderboard(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/social/leaderboard${query ? `?${query}` : ''}`);
  }

  async getMyCopies() {
    return this.request('/social/my-copies');
  }

  // Provider detail.
  async getProvider(providerId) {
    return this.request(`/social/providers/${providerId}`);
  }

  // Start copying a master. Backend takes master_id + amount (+ optional
  // account_id) as QUERY params, not a JSON body.
  async copyMaster(masterId, amount, accountId) {
    const q = new URLSearchParams({ master_id: masterId, amount: String(amount) });
    if (accountId) q.append('account_id', accountId);
    return this.request(`/social/copy?${q.toString()}`, { method: 'POST' });
  }

  // Stop an active copy allocation.
  async stopCopy(allocationId) {
    return this.request(`/social/copy/${allocationId}`, { method: 'DELETE' });
  }

  async getFollowRequests() {
    return this.request('/social/follow-requests');
  }

  async respondFollowRequest(allocationId, approve) {
    return this.request(`/social/follow-requests/${allocationId}`, {
      method: 'POST',
      body: JSON.stringify({ approve: !!approve }),
    });
  }

  async getMAMMPAMM() {
    return this.request('/social/mamm-pamm');
  }

  async investInMAMMPAMM(accountId, amount) {
    return this.request(`/social/mamm-pamm/${accountId}/invest`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  async getMyProvider(masterType) {
    const q = masterType ? `?master_type=${encodeURIComponent(masterType)}` : '';
    return this.request(`/social/my-provider${q}`);
  }

  // Apply to become a master/provider. Config goes in the QUERY string;
  // strategy_info (optional) is the JSON body.
  // master_type: 'signal_provider' | 'pamm' | 'mam'
  async becomeProvider({
    master_type = 'signal_provider',
    performance_fee_pct,
    management_fee_pct,
    min_investment,
    max_investors,
    account_id,
    strategy_info,
  } = {}) {
    const q = new URLSearchParams({ master_type });
    if (performance_fee_pct != null) q.append('performance_fee_pct', String(performance_fee_pct));
    if (management_fee_pct != null) q.append('management_fee_pct', String(management_fee_pct));
    if (min_investment != null) q.append('min_investment', String(min_investment));
    if (max_investors != null) q.append('max_investors', String(max_investors));
    if (account_id) q.append('account_id', account_id);
    return this.request(`/social/become-provider?${q.toString()}`, {
      method: 'POST',
      body: JSON.stringify(strategy_info || {}),
    });
  }

  // Algo Connector — API keys for trading the account from an external bot.
  // Mirrors the website's /algo-connector page: one key pair per trading
  // account, generated once and revocable.
  async getAlgoAccounts() {
    return this.request('/algo/accounts');
  }

  // Generating REVOKES the account's previous key — the secret is returned
  // exactly once here and is never retrievable again.
  async generateAlgoKey(accountId) {
    return this.request('/algo/generate', {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId }),
    });
  }

  async revokeAlgoKey(keyId) {
    return this.request('/algo/revoke', {
      method: 'POST',
      body: JSON.stringify({ key_id: keyId }),
    });
  }

  // Business/IB APIs
  async getBusinessStatus() {
    return this.request('/business/status');
  }

  async applyForIB() {
    return this.request('/business/apply', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async getIBDashboard() {
    return this.request('/business/ib/dashboard');
  }

  async getIBReferrals() {
    return this.request('/business/ib/referrals');
  }

  async getIBCommissions() {
    return this.request('/business/ib/commissions');
  }

  async getIBTree() {
    return this.request('/business/ib/tree');
  }

  async applyForSubBroker(data) {
    return this.request('/business/apply-sub-broker', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSubBrokerDashboard() {
    return this.request('/business/sub-broker/dashboard');
  }

  // Profile APIs
  async getProfile() {
    return this.request('/profile');
  }

  async updateProfile(data) {
    return this.request('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async uploadDocument(formData) {
    const token = await SecureStore.getItemAsync('token');
    const response = await fetch(`${this.baseUrl}/profile/upload-document`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(toMessage(data, 'Upload failed'));
    }
    return data;
  }

  // Support APIs
  async getTickets(page = 1, perPage = 20) {
    return this.request(`/support/tickets?page=${page}&per_page=${perPage}`);
  }

  async createTicket(data) {
    return this.request('/support/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTicketDetails(ticketId) {
    return this.request(`/support/tickets/${ticketId}`);
  }

  async replyToTicket(ticketId, message) {
    return this.request(`/support/tickets/${ticketId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  // Notifications APIs
  async getNotifications(page = 1, perPage = 20) {
    return this.request(`/notifications?page=${page}&per_page=${perPage}`);
  }

  async markNotificationRead(notificationId) {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  }

  // Banners API
  async getBanners(page = 'dashboard') {
    return this.request(`/banners?page=${page}`);
  }

  async trackBannerClick(bannerId) {
    return this.request(`/banners/${bannerId}/click`, { method: 'POST' });
  }

  // Accounts APIs
  async getAccounts() {
    return this.request('/accounts');
  }

  async createAccount(data) {
    return this.request('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAvailableAccountGroups() {
    return this.request('/accounts/available-groups');
  }

  async openAccount(accountGroupId) {
    return this.request('/accounts/open', {
      method: 'POST',
      body: JSON.stringify({ account_group_id: accountGroupId }),
    });
  }

  async deleteAccount(accountId) {
    return this.request(`/accounts/${accountId}`, {
      method: 'DELETE',
    });
  }

  async transferInternal(fromAccountId, toAccountId, amount) {
    return this.request('/wallet/transfer-internal', {
      method: 'POST',
      body: JSON.stringify({
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount,
      }),
    });
  }

  // Main wallet → a live trading account.
  async transferMainToTrading(toAccountId, amount) {
    return this.request('/wallet/transfer-main-to-trading', {
      method: 'POST',
      body: JSON.stringify({ to_account_id: toAccountId, amount }),
    });
  }

  // A live trading account → main wallet.
  async transferTradingToMain(fromAccountId, amount) {
    return this.request('/wallet/transfer-trading-to-main', {
      method: 'POST',
      body: JSON.stringify({ from_account_id: fromAccountId, amount }),
    });
  }

  // KYC API. No trailing slash — `/submit/` 307-redirects and React Native
  // drops the multipart body across the redirect ("Network request failed").
  async submitKyc(formData) {
    const token = await SecureStore.getItemAsync('token');
    const res = await fetch(`${this.baseUrl}/profile/kyc/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(toMessage(data, 'KYC submit failed'));
    return data;
  }

  // PAMM allocations (web format)
  async getMyAllocations() {
    return this.request('/social/my-allocations');
  }

  async withdrawAllocation(masterId) {
    return this.request(`/social/mamm-pamm/${masterId}/withdraw`, {
      method: 'DELETE',
    });
  }

  async getMasterPerformance() {
    return this.request('/social/master-performance');
  }

  async getMasterInvestors() {
    return this.request('/social/master-investors');
  }

  // Instruments APIs
  async getInstruments() {
    // Trailing slash to match the website's call exactly (the route is GET
    // /instruments/) — avoids a 307 redirect that can drop auth / alter results.
    return this.request('/instruments/');
  }

  async getAllPrices() {
    return this.request('/instruments/prices/all');
  }

  // Single-symbol live price: { symbol, bid, ask, spread }.
  async getPrice(symbol) {
    return this.request(`/instruments/${encodeURIComponent(symbol)}/price`);
  }

  async getBars(symbol, { resolution = '60', limit = 24 } = {}) {
    const query = new URLSearchParams({ resolution: String(resolution), limit: String(limit) });
    const res = await this.request(`/instruments/${encodeURIComponent(symbol)}/bars?${query.toString()}`);
    // Backend returns UDF-style { s, bars, noData } — normalise to a bars array.
    if (Array.isArray(res)) return res;
    return res?.bars || res?.items || res?.data || res?.candles || [];
  }

  // Orders APIs
  async getOrders(accountId, status = null) {
    const query = new URLSearchParams({ account_id: accountId });
    if (status) query.append('status', status);
    // Trailing slash is required — `/orders` (no slash) 307-redirects and the
    // Authorization header is dropped, returning 401.
    return this.request(`/orders/?${query.toString()}`);
  }

  async placeOrder(data) {
    // Backend requires account_id as a query param on POST /orders (it also
    // stays in the body for the order payload).
    const accountId = data?.account_id;
    const query = accountId ? `?account_id=${encodeURIComponent(accountId)}` : '';
    return this.request(`/orders/${query}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async modifyOrder(orderId, data) {
    return this.request(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async cancelOrder(orderId) {
    return this.request(`/orders/${orderId}`, {
      method: 'DELETE',
    });
  }

  // Positions APIs
  async getPositions(accountId, status = 'open') {
    const query = new URLSearchParams({ account_id: accountId, status });
    // Trailing slash required (see getOrders) — otherwise 401 on redirect.
    return this.request(`/positions/?${query.toString()}`);
  }

  async modifyPosition(positionId, data) {
    return this.request(`/positions/${positionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async closePosition(positionId, lots = null) {
    const body = lots ? { lots } : {};
    return this.request(`/positions/${positionId}/close`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Account Summary API
  async getAccountSummary(accountId) {
    return this.request(`/accounts/${accountId}/summary`);
  }

}

export default new ApiService();
