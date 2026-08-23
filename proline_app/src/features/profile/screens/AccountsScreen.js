import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../../../app/providers/ThemeContext';
import { useAccount } from '../../../app/providers/AccountContext';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import ApiService from '../../../services/api/ApiService';
import logger from '../../../utils/logger';

function isDemoAccount(a) {
  return !!(a?.is_demo || a?.isDemo || a?.accountTypeId?.isDemo);
}

function isActiveStatus(a) {
  const s = String(a?.status || '').toLowerCase();
  return !s || s === 'active';
}

const AccountsScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { selectAccount } = useAccount();
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Transfer states
  const [walletBalance, setWalletBalance] = useState(0);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showWithdrawRequestModal, setShowWithdrawRequestModal] = useState(false);
  const [showAccountTransferModal, setShowAccountTransferModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [targetAccount, setTargetAccount] = useState(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  
  // Withdrawal request states
  const [withdrawMethod, setWithdrawMethod] = useState('Bank'); // 'Bank', 'UPI'
  const [bankDetails, setBankDetails] = useState({
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
  });
  const [upiId, setUpiId] = useState('');

  // Account creation states (matches web /accounts/available-groups + POST /accounts/open)
  const [showOpenModal, setShowOpenModal] = useState(false);
  // Holds the freshly-created account for the professional success popup.
  const [successAccount, setSuccessAccount] = useState(null);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [openingAccount, setOpeningAccount] = useState(false);

  // Delete account state
  const [deletingAccountId, setDeletingAccountId] = useState(null);

  // Expand/collapse + label editing for cards
  const [expandedAccountId, setExpandedAccountId] = useState(null);
  const [accountLabels, setAccountLabels] = useState({});
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [labelDraft, setLabelDraft] = useState('');

  // Load saved labels from SecureStore
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('accountLabels');
        if (stored) setAccountLabels(JSON.parse(stored));
      } catch (e) {}
    })();
  }, []);

  const saveLabel = async (aid) => {
    const next = { ...accountLabels };
    const v = (labelDraft || '').trim();
    if (v) next[aid] = v;
    else delete next[aid];
    setAccountLabels(next);
    try {
      await SecureStore.setItemAsync('accountLabels', JSON.stringify(next));
    } catch (e) {}
    setEditingLabelId(null);
    setLabelDraft('');
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  // Handle incoming route params for deposit/withdraw action
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      // Fetch all data and then set loading false
      const loadData = async () => {
        try {
          await Promise.all([fetchAccounts(), fetchWalletBalance()]);
        } catch (e) {
          logger.error('AccountsScreen: error loading accounts data', e);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }
  }, [user]);
  
  // Auto-open the new-account modal if navigated with action=open
  useEffect(() => {
    if (route?.params?.action === 'open') {
      openNewAccountModal();
      navigation.setParams({ action: null });
    }
  }, [route?.params?.action]);

  // Handle route params to auto-open deposit/withdraw modal
  useEffect(() => {
    if (route?.params?.action && route?.params?.accountId && accounts.length > 0) {
      const account = accounts.find(
        (a) => String(a.id || a._id) === String(route.params.accountId)
      );
      if (account) {
        setSelectedAccount(account);
        setTransferAmount('');
        if (route.params.action === 'deposit') {
          fetchWalletBalance();
          setShowTransferModal(true);
        } else if (route.params.action === 'withdraw') {
          setShowWithdrawModal(true);
        }
        // Clear the params to prevent re-triggering
        navigation.setParams({ action: null, accountId: null });
      }
    }
  }, [route?.params, accounts]);

  const fetchWalletBalance = async () => {
    try {
      const data = await ApiService.getWalletSummary();
      // API sometimes returns strings like "0" or "100.50" — coerce via Number.
      //
      // There used to be a "fallback" here that re-fetched GET /wallet/:userId
      // whenever the summary reported 0. That route does not exist (the wallet
      // router only serves /summary, /deposits, /withdrawals, /transactions and
      // the transfer endpoints), so the fallback could never succeed — it just
      // logged a 404 for every user whose balance was legitimately 0, which is
      // every newly registered user. /wallet/summary is the single source of
      // truth: if it says 0, the balance is 0.
      const mainBal = data.main_wallet_balance ?? data.wallet_balance ?? data.balance;
      setWalletBalance(Number(mainBal) || 0);
    } catch (e) {
      logger.error('AccountsScreen: error fetching wallet', e);
    }
  };

  const loadUser = async () => {
    try {
      const userData = await SecureStore.getItemAsync('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (e) {
      logger.error('AccountsScreen: error loading user', e);
    }
  };

  const fetchAccounts = async () => {
    if (!user) return;
    try {
      logger.log('AccountsScreen - Fetching accounts with token auth');
      const data = await ApiService.getAccounts();
      const items = data.items || data || [];
      // Map TrustEdge account fields to expected format (show both demo and live, like web)
      const mappedAccounts = items.map((a) => ({
        ...a,
        id: a.id || a._id,
        _id: a.id || a._id,
        accountId: a.account_number || a.accountId || a.id,
        account_number: a.account_number,
        isDemo: a.is_demo || a.isDemo || false,
        status: a.status === 'active' ? 'Active' : (a.status || 'Active'),
        accountType: a.account_type || a.accountType || (a.account_group?.name) || 'Standard',
      }));
      logger.log('AccountsScreen - Accounts response:', mappedAccounts.length, 'accounts (demo+live)');
      setAccounts(mappedAccounts);
    } catch (e) {
      logger.warn('AccountsScreen - Error fetching accounts:', e.message);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAccounts(), fetchWalletBalance()]);
    setRefreshing(false);
  };


  const handleDeposit = (account) => {
    logger.log('Opening deposit modal for account:', account.accountId, account._id);
    setSelectedAccount(account);
    setTransferAmount('');
    fetchWalletBalance(); // Refresh wallet balance
    setShowTransferModal(true);
  };

  const handleWithdraw = (account) => {
    logger.log('Opening withdraw modal for account:', account.accountId, account._id);
    setSelectedAccount(account);
    setTransferAmount('');
    setShowWithdrawModal(true);
  };

  const handleAccountTransfer = (account) => {
    setSelectedAccount(account);
    setTargetAccount(null);
    setTransferAmount('');
    setShowAccountTransferModal(true);
  };

  // Transfer from wallet to account - TrustEdge uses wallet deposit
  const handleTransferFunds = async () => {
    if (!selectedAccount || !selectedAccount._id) {
      Alert.alert('Error', 'No account selected');
      return;
    }
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (parseFloat(transferAmount) > walletBalance) {
      Alert.alert('Error', 'Insufficient wallet balance');
      return;
    }

    setIsTransferring(true);
    try {
      const accountId = selectedAccount.id || selectedAccount._id;
      const amount = parseFloat(transferAmount);

      // Try the web endpoint first (matches frontend/trader)
      try {
        await ApiService.transferMainToTrading(accountId, amount);
      } catch (err) {
        // Fall back to legacy /wallet/deposit if the new endpoint isn't available
        if (/not found|method not allowed|404|405/i.test(err?.message || '')) {
          await ApiService.submitDeposit({
            account_id: accountId,
            amount,
            method: 'internal_transfer',
          });
        } else {
          throw err;
        }
      }

      await Promise.all([fetchAccounts(), fetchWalletBalance()]);
      setShowTransferModal(false);
      setTransferAmount('');
      setSelectedAccount(null);
      Alert.alert('Success', 'Funds transferred to account!');
    } catch (e) {
      logger.error('AccountsScreen: transfer error', e);
      Alert.alert('Error', e.message || 'Transfer failed');
    }
    setIsTransferring(false);
  };

  // Withdraw from account to wallet - TrustEdge uses wallet withdraw
  const handleWithdrawFromAccount = async () => {
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!selectedAccount) {
      Alert.alert('Error', 'No account selected');
      return;
    }
    if (parseFloat(transferAmount) > (selectedAccount.balance || 0)) {
      Alert.alert('Error', 'Insufficient account balance');
      return;
    }

    setIsTransferring(true);
    try {
      const accountId = selectedAccount.id || selectedAccount._id;
      const amount = parseFloat(transferAmount);

      // Try the web endpoint first
      try {
        await ApiService.transferTradingToMain(accountId, amount);
      } catch (err) {
        // Fall back to legacy /wallet/withdraw with internal_transfer method
        if (/not found|method not allowed|404|405/i.test(err?.message || '')) {
          await ApiService.submitWithdrawal({
            account_id: accountId,
            amount,
            method: 'internal_transfer',
          });
        } else {
          throw err;
        }
      }

      await Promise.all([fetchAccounts(), fetchWalletBalance()]);
      setShowWithdrawModal(false);
      setTransferAmount('');
      setSelectedAccount(null);
      Alert.alert('Success', 'Funds withdrawn to main wallet!');
    } catch (e) {
      logger.error('AccountsScreen: withdraw error', e);
      Alert.alert('Error', e.message || 'Withdrawal failed');
    }
    setIsTransferring(false);
  };

  // Submit withdrawal request to admin (from wallet to bank/UPI)
  const handleWithdrawRequest = async () => {
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (parseFloat(transferAmount) > walletBalance) {
      Alert.alert('Error', 'Insufficient wallet balance');
      return;
    }

    // Validate payment details
    if (withdrawMethod === 'Bank') {
      if (!bankDetails.bankName || !bankDetails.accountNumber || !bankDetails.ifscCode || !bankDetails.accountHolderName) {
        Alert.alert('Error', 'Please fill all bank details');
        return;
      }
    } else if (withdrawMethod === 'UPI') {
      if (!upiId) {
        Alert.alert('Error', 'Please enter UPI ID');
        return;
      }
    }

    setIsTransferring(true);
    try {
      const bankAccountDetails = withdrawMethod === 'Bank'
        ? {
            type: 'Bank',
            bankName: bankDetails.bankName,
            accountNumber: bankDetails.accountNumber,
            ifscCode: bankDetails.ifscCode,
            accountHolderName: bankDetails.accountHolderName,
          }
        : {
            type: 'UPI',
            upiId: upiId,
          };

      await ApiService.submitWithdrawal({
        amount: parseFloat(transferAmount),
        method: withdrawMethod === 'Bank' ? 'bank' : 'upi',
        bank_details: bankAccountDetails,
      });

      Alert.alert('Success', 'Withdrawal request submitted! Admin will process it shortly.');
      setShowWithdrawRequestModal(false);
      setTransferAmount('');
      setBankDetails({ bankName: '', accountNumber: '', ifscCode: '', accountHolderName: '' });
      setUpiId('');
      fetchWalletBalance();
    } catch (e) {
      logger.error('AccountsScreen: withdrawal request error', e);
      Alert.alert('Error', e.message || 'Withdrawal request failed');
    }
    setIsTransferring(false);
  };

  // Transfer between accounts - matches web POST /wallet/transfer-internal
  const handleAccountToAccountTransfer = async () => {
    if (!selectedAccount?._id) {
      Alert.alert('Error', 'No source account selected');
      return;
    }
    if (!targetAccount?._id) {
      Alert.alert('Error', 'Please select a target account');
      return;
    }
    if (selectedAccount._id === targetAccount._id) {
      Alert.alert('Error', 'Source and target must be different accounts');
      return;
    }
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    const freeMargin = Number(selectedAccount.free_margin ?? selectedAccount.balance ?? 0);
    if (parseFloat(transferAmount) > freeMargin) {
      Alert.alert('Error', 'Insufficient free margin in source account');
      return;
    }

    setIsTransferring(true);
    try {
      await ApiService.transferInternal(
        selectedAccount.id || selectedAccount._id,
        targetAccount.id || targetAccount._id,
        parseFloat(transferAmount),
      );
      await Promise.all([fetchAccounts(), fetchWalletBalance()]);
      setShowAccountTransferModal(false);
      setTransferAmount('');
      setSelectedAccount(null);
      setTargetAccount(null);
      Alert.alert('Success', 'Funds transferred between accounts');
    } catch (e) {
      logger.error('AccountsScreen: account transfer error', e);
      Alert.alert('Error', e.message || 'Transfer failed');
    }
    setIsTransferring(false);
  };

  // Fetch available account groups for new account creation
  const fetchAccountGroups = async () => {
    setGroupsLoading(true);
    try {
      const data = await ApiService.getAvailableAccountGroups();
      const items = data.items || data || [];
      setGroups(Array.isArray(items) ? items : []);
    } catch (e) {
      logger.warn('Account groups fetch error:', e.message);
      setGroups([]);
    }
    setGroupsLoading(false);
  };

  const openNewAccountModal = async () => {
    // No KYC gate — platform policy is open/deposit/trade freely; identity
    // is verified at withdrawal time instead (see kycGate.js).
    setSelectedGroupId(null);
    setShowOpenModal(true);
    await fetchAccountGroups();
  };

  // Create new trading account (matches web POST /accounts/open)
  const handleOpenAccount = async () => {
    if (!selectedGroupId) {
      Alert.alert('Account type', 'Please select an account type');
      return;
    }
    const grp = groups.find((g) => g.id === selectedGroupId) || {};
    setOpeningAccount(true);
    try {
      const data = await ApiService.openAccount(selectedGroupId);
      setShowOpenModal(false);
      setSelectedGroupId(null);
      await fetchAccounts();
      // Professional in-app success popup instead of the native OS alert.
      setSuccessAccount({
        account_number: data.account_number || data.account_id || data.id || '—',
        type: grp.name || 'Trading',
        leverage: data.leverage || grp.leverage_default || null,
        is_demo: !!(data.is_demo || grp.is_demo),
      });
    } catch (e) {
      logger.error('AccountsScreen: open account error', e);
      Alert.alert('Error', e.message || 'Could not open account');
    }
    setOpeningAccount(false);
  };

  // Delete a trading account
  const handleDeleteAccount = (account) => {
    const aid = account.id || account._id;
    const label = account.account_number || account.accountId || 'this account';
    Alert.alert(
      'Delete account',
      `Permanently delete ${label}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccountId(aid);
            try {
              await ApiService.deleteAccount(aid);
              setAccounts((prev) => prev.filter((a) => (a.id || a._id) !== aid));
              Alert.alert('Deleted', 'Account removed');
            } catch (e) {
              logger.error('AccountsScreen: delete account error', e);
              Alert.alert('Error', e.message);
            }
            setDeletingAccountId(null);
          },
        },
      ]
    );
  };

  const selectAccountForTrading = async (account) => {
    const aid = account.id || account._id;
    try {
      await SecureStore.setItemAsync('selectedAccountId', aid);
    } catch (e) {}
    // Jump to the Trade tab (CFDs) with this account pre-selected.
    navigation.navigate('TradeTab', { screen: 'Trade', params: { selectedAccountId: aid } });
  };

  // Copy/MAM account → open its portfolio (the master's mirrored open positions
  // + trade history live on this account).
  const viewMasterTrades = (account) => {
    selectAccount(account);
    navigation.navigate('HomeTab', { screen: 'Portfolio' });
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Show all active accounts (demo + live), like web
  const mainTradingAccounts = accounts.filter((a) => isActiveStatus(a));

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgPrimary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Trading Accounts</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>Manage your trading accounts</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_PILL_HEIGHT + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* New Account button — full width dashed (matches web) */}
        <TouchableOpacity
          onPress={openNewAccountModal}
          activeOpacity={0.85}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 18,
            borderRadius: 14,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: colors.accent,
            backgroundColor: 'transparent',
            marginBottom: 16,
          }}
        >
          <Ionicons name="add" size={20} color={colors.accent} />
          <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '700' }}>New Account</Text>
        </TouchableOpacity>

        {mainTradingAccounts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No trading account</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Tap "+ New Account" above to open one.</Text>
          </View>
        ) : (
          mainTradingAccounts.map((account) => {
            const aid = account.id || account._id;
            const isExpanded = expandedAccountId === aid;
            const isDemo = isDemoAccount(account);
            const dotColor = isDemo ? colors.warning : colors.accent;
            const customLabel = accountLabels[aid];
            const defaultLabel = isDemo ? 'Demo Account' : 'Live Account';
            const balance = Number(account.balance || 0);
            const credit = Number(account.credit || 0);
            const equity = Number(account.equity || balance + credit);
            const pnl = equity - balance - credit;
            const pnlPct = balance > 0 ? (pnl / balance) * 100 : 0;
            const lev = String(account.leverage || '').includes(':')
              ? account.leverage
              : `1:${account.leverage || 100}`;
            const acctType = account.account_group?.name || account.accountTypeId?.name || account.accountType || 'Standard';
            const acctNum = account.account_number || account.accountId || '';
            // PAMM / MAM / Copy tag so each account type is identifiable.
            const ctype = String(account.copy_type || '').toLowerCase();
            // MAM is folded into Copy — the app only surfaces PAMM + Copy Trading.
            const typeTag = ctype === 'pamm' ? 'PAMM'
              : (account.is_copy_trading || ['mam', 'mamm', 'signal_provider', 'signal'].includes(ctype)) ? 'Copy'
              : null;
            const numPrefix = isDemo ? 'D' : 'L';

            return (
              <View
                key={String(aid)}
                style={{
                  backgroundColor: colors.bgCard,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginBottom: 14,
                  overflow: 'hidden',
                }}
              >
                {/* Collapsed header — always visible, tap to expand */}
                <Pressable
                  onPress={() => {
                    setExpandedAccountId(isExpanded ? null : aid);
                  }}
                  android_ripple={{ color: 'rgba(255,255,255,0.05)' }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.96 : 1 })}
                >
                  {/* Tinted gradient header (account-type colour) */}
                  <LinearGradient
                    colors={[dotColor + '2E', dotColor + '0D', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 }}
                  >
                    {/* Avatar + label + number + tag + chevron */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: dotColor + '26', borderWidth: 1, borderColor: dotColor + '55', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Ionicons name={isDemo ? 'flask-outline' : 'wallet-outline'} size={21} color={dotColor} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '800', flexShrink: 1 }}>
                            {customLabel || defaultLabel}
                          </Text>
                          {typeTag ? (
                            <View style={{ backgroundColor: colors.accent + '22', borderColor: colors.accent, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
                              <Text style={{ color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>{typeTag}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2 }}>#{numPrefix}#{acctNum}</Text>
                      </View>
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
                    </View>

                    {/* Balance + inline label edit */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>Balance</Text>
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: colors.textPrimary, fontSize: 27, fontWeight: '900', marginTop: 2, letterSpacing: -0.5 }}>
                          ${balance.toFixed(2)}
                        </Text>
                      </View>
                      {editingLabelId === aid ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                          <TextInput
                            autoFocus
                            value={labelDraft}
                            onChangeText={setLabelDraft}
                            placeholder="Label"
                            placeholderTextColor={colors.textMuted}
                            style={{ width: 84, borderWidth: 1, borderColor: colors.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, color: colors.textPrimary, fontSize: 12 }}
                          />
                          <TouchableOpacity onPress={() => saveLabel(aid)} style={{ marginLeft: 6, padding: 4 }}>
                            <Ionicons name="checkmark" size={18} color={colors.accent} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => { setEditingLabelId(null); setLabelDraft(''); }} style={{ padding: 4 }}>
                            <Ionicons name="close" size={18} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={(e) => { e?.stopPropagation?.(); setEditingLabelId(aid); setLabelDraft(customLabel || ''); }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingLeft: 8 }}
                        >
                          <Ionicons name="pencil-outline" size={13} color={colors.accent} />
                          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>{customLabel ? 'Edit' : 'Label'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </LinearGradient>

                  {/* Divider stats: Equity | P&L | Leverage */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '600' }}>Equity</Text>
                      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800', marginTop: 3 }}>${equity.toFixed(2)}</Text>
                    </View>
                    <View style={{ width: StyleSheet.hairlineWidth, height: 30, backgroundColor: colors.border, marginHorizontal: 12 }} />
                    <View style={{ flex: 1.35, minWidth: 0 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '600' }}>P&L</Text>
                      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: pnl >= 0 ? colors.success : colors.error, fontSize: 14, fontWeight: '800', marginTop: 3 }}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                      </Text>
                    </View>
                    <View style={{ width: StyleSheet.hairlineWidth, height: 30, backgroundColor: colors.border, marginHorizontal: 12 }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '600' }}>Leverage</Text>
                      <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800', marginTop: 3 }}>{lev}</Text>
                    </View>
                  </View>
                </Pressable>

                {/* Expanded section */}
                {isExpanded && (
                  <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
                    <View style={{ flexDirection: 'row', marginTop: 14 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>Currency</Text>
                        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 4 }}>
                          {account.currency || 'USD'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>Created</Text>
                        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 4 }}>
                          {formatDate(account.created_at)}
                        </Text>
                      </View>
                    </View>

                    <View style={{ marginTop: 14 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>Account type</Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 4 }}>
                        {acctType}
                      </Text>
                    </View>

                    {/* Free margin (extra info) */}
                    <View style={{ marginTop: 14 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>Free margin</Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 4 }}>
                        ${(account.free_margin != null ? Number(account.free_margin) : 0).toFixed(2)}
                      </Text>
                    </View>

                    {/* Trade — primary CTA (Pressable for reliable Android touch) */}
                    <Pressable
                      onPress={() => {
                        logger.log('[AccountsScreen] Trade button pressed', aid);
                        selectAccountForTrading(account);
                      }}
                      android_ripple={{ color: 'rgba(0,0,0,0.15)' }}
                      hitSlop={8}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        backgroundColor: colors.accent,
                        borderRadius: 12,
                        paddingVertical: 14,
                        marginTop: 18,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Ionicons name="open-outline" size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Trade</Text>
                    </Pressable>

                    {/* Copy / MAM / PAMM account → view the master's mirrored trades */}
                    {typeTag ? (
                      <Pressable
                        onPress={() => viewMasterTrades(account)}
                        android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
                        hitSlop={8}
                        style={({ pressed }) => ({
                          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                          backgroundColor: colors.accent + '1A', borderWidth: 1, borderColor: colors.accent,
                          borderRadius: 12, paddingVertical: 13, marginTop: 10, opacity: pressed ? 0.8 : 1,
                        })}
                      >
                        <Ionicons name="stats-chart-outline" size={17} color={colors.accent} />
                        <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '800' }}>View master trades</Text>
                      </Pressable>
                    ) : null}

                    {/* Fund movement row */}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <Pressable
                        onPress={() => {
                          logger.log('[AccountsScreen] Deposit pressed', aid);
                          handleDeposit(account);
                        }}
                        android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
                        hitSlop={6}
                        style={({ pressed }) => ({
                          flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                          gap: 6, paddingVertical: 12, borderRadius: 10,
                          backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.border,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Ionicons name="arrow-down-circle-outline" size={16} color={colors.textPrimary} />
                        <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>Deposit</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          logger.log('[AccountsScreen] Withdraw pressed', aid);
                          handleWithdraw(account);
                        }}
                        android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
                        hitSlop={6}
                        style={({ pressed }) => ({
                          flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                          gap: 6, paddingVertical: 12, borderRadius: 10,
                          backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.border,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Ionicons name="arrow-up-circle-outline" size={16} color={colors.textPrimary} />
                        <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>Withdraw</Text>
                      </Pressable>
                      {mainTradingAccounts.length > 1 && (
                        <Pressable
                          onPress={() => {
                            logger.log('[AccountsScreen] Transfer pressed', aid);
                            handleAccountTransfer(account);
                          }}
                          android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
                          hitSlop={6}
                          style={({ pressed }) => ({
                            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                            gap: 6, paddingVertical: 12, borderRadius: 10,
                            backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.border,
                            opacity: pressed ? 0.7 : 1,
                          })}
                        >
                          <Ionicons name="swap-horizontal-outline" size={16} color={colors.textPrimary} />
                          <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>Transfer</Text>
                        </Pressable>
                      )}
                    </View>

                    {/* Close account — destructive */}
                    <Pressable
                      onPress={() => {
                        logger.log('[AccountsScreen] Close account pressed', aid);
                        handleDeleteAccount(account);
                      }}
                      disabled={deletingAccountId === aid}
                      android_ripple={{ color: 'rgba(239,68,68,0.15)' }}
                      hitSlop={6}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        marginTop: 14,
                        paddingVertical: 12,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      {deletingAccountId === aid ? (
                        <ActivityIndicator size="small" color={colors.error} />
                      ) : (
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                      )}
                      <Text style={{ color: colors.error, fontSize: 13, fontWeight: '700' }}>Close account</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Deposit Modal - Transfer from Wallet to Account */}
      <Modal visible={showTransferModal} animationType="slide" transparent onRequestClose={() => setShowTransferModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowTransferModal(false)} />
          <View style={[styles.transferModalContent, { backgroundColor: colors.bgCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Deposit to Account</Text>
              <TouchableOpacity onPress={() => setShowTransferModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            
            <View style={[styles.transferInfo, { backgroundColor: colors.bgSecondary }]}>
              <View style={[styles.transferInfoRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.transferLabel, { color: colors.textMuted }]}>From</Text>
                <Text style={[styles.transferValue, { color: colors.textPrimary }]}>Main Wallet</Text>
              </View>
              <View style={[styles.transferInfoRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.transferLabel, { color: colors.textMuted }]}>Available</Text>
                <Text style={[styles.transferValueGold, { color: colors.primary }]}>${walletBalance.toFixed(2)}</Text>
              </View>
              <View style={[styles.transferInfoRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.transferLabel, { color: colors.textMuted }]}>To</Text>
                <Text style={[styles.transferValue, { color: colors.textPrimary }]}>{selectedAccount?.accountId}</Text>
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Amount (USD)</Text>
            <TextInput
              style={[styles.transferInput, { backgroundColor: colors.bgSecondary, borderColor: colors.border, color: colors.textPrimary }]}
              value={transferAmount}
              onChangeText={setTransferAmount}
              placeholder="Enter amount"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />

            <TouchableOpacity 
              style={[styles.transferSubmitBtn, isTransferring && styles.btnDisabled]}
              onPress={handleTransferFunds}
              disabled={isTransferring}
            >
              {isTransferring ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.transferSubmitBtnText}>Transfer to Account</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Withdraw Modal - Transfer from Account to Wallet */}
      <Modal visible={showWithdrawModal} animationType="slide" transparent onRequestClose={() => setShowWithdrawModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowWithdrawModal(false)} />
          <View style={[styles.transferModalContent, { backgroundColor: colors.bgCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Withdraw to Wallet</Text>
              <TouchableOpacity onPress={() => setShowWithdrawModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            
            <View style={[styles.transferInfo, { backgroundColor: colors.bgSecondary }]}>
              <View style={[styles.transferInfoRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.transferLabel, { color: colors.textMuted }]}>From</Text>
                <Text style={[styles.transferValue, { color: colors.textPrimary }]}>{selectedAccount?.accountId}</Text>
              </View>
              <View style={[styles.transferInfoRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.transferLabel, { color: colors.textMuted }]}>Available</Text>
                <Text style={[styles.transferValueGold, { color: colors.primary }]}>${(selectedAccount?.balance || 0).toFixed(2)}</Text>
              </View>
              <View style={[styles.transferInfoRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.transferLabel, { color: colors.textMuted }]}>To</Text>
                <Text style={[styles.transferValue, { color: colors.textPrimary }]}>Main Wallet</Text>
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Amount (USD)</Text>
            <TextInput
              style={[styles.transferInput, { backgroundColor: colors.bgSecondary, borderColor: colors.border, color: colors.textPrimary }]}
              value={transferAmount}
              onChangeText={setTransferAmount}
              placeholder="Enter amount"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />

            <TouchableOpacity 
              style={[styles.withdrawSubmitBtn, { backgroundColor: colors.primary }, isTransferring && styles.btnDisabled]}
              onPress={handleWithdrawFromAccount}
              disabled={isTransferring}
            >
              {isTransferring ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.withdrawSubmitBtnText}>Withdraw to Wallet</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Withdrawal Request Modal - To Bank/UPI */}
      <Modal visible={showWithdrawRequestModal} animationType="slide" transparent onRequestClose={() => setShowWithdrawRequestModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowWithdrawRequestModal(false)} />
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }}>
            <View style={[styles.transferModalContent, { backgroundColor: colors.bgCard, maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Withdraw Funds</Text>
                <TouchableOpacity onPress={() => setShowWithdrawRequestModal(false)}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              
              <View style={[styles.transferInfo, { backgroundColor: colors.bgSecondary }]}>
                <View style={[styles.transferInfoRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.transferLabel, { color: colors.textMuted }]}>Wallet Balance</Text>
                  <Text style={[styles.transferValueGold, { color: colors.primary }]}>${walletBalance.toFixed(2)}</Text>
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Amount (USD)</Text>
              <TextInput
                style={[styles.transferInput, { backgroundColor: colors.bgSecondary, borderColor: colors.border, color: colors.textPrimary }]}
                value={transferAmount}
                onChangeText={setTransferAmount}
                placeholder="Enter amount"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />

              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Payment Method</Text>
              <View style={styles.methodRow}>
                <TouchableOpacity
                  style={[styles.methodBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }, withdrawMethod === 'Bank' && { backgroundColor: `${colors.primary}20`, borderColor: colors.primary }]}
                  onPress={() => setWithdrawMethod('Bank')}
                >
                  <Ionicons name="business-outline" size={20} color={withdrawMethod === 'Bank' ? colors.primary : colors.textMuted} />
                  <Text style={[styles.methodBtnText, { color: withdrawMethod === 'Bank' ? colors.primary : colors.textMuted }]}>Bank Transfer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.methodBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }, withdrawMethod === 'UPI' && { backgroundColor: `${colors.primary}20`, borderColor: colors.primary }]}
                  onPress={() => setWithdrawMethod('UPI')}
                >
                  <Ionicons name="phone-portrait-outline" size={20} color={withdrawMethod === 'UPI' ? colors.primary : colors.textMuted} />
                  <Text style={[styles.methodBtnText, { color: withdrawMethod === 'UPI' ? colors.primary : colors.textMuted }]}>UPI</Text>
                </TouchableOpacity>
              </View>

              {withdrawMethod === 'Bank' && (
                <View>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Account Holder Name</Text>
                  <TextInput
                    style={[styles.transferInput, { backgroundColor: colors.bgSecondary, borderColor: colors.border, color: colors.textPrimary }]}
                    value={bankDetails.accountHolderName}
                    onChangeText={(text) => setBankDetails({ ...bankDetails, accountHolderName: text })}
                    placeholder="Enter account holder name"
                    placeholderTextColor={colors.textMuted}
                  />
                  
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Bank Name</Text>
                  <TextInput
                    style={[styles.transferInput, { backgroundColor: colors.bgSecondary, borderColor: colors.border, color: colors.textPrimary }]}
                    value={bankDetails.bankName}
                    onChangeText={(text) => setBankDetails({ ...bankDetails, bankName: text })}
                    placeholder="Enter bank name"
                    placeholderTextColor={colors.textMuted}
                  />
                  
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Account Number</Text>
                  <TextInput
                    style={[styles.transferInput, { backgroundColor: colors.bgSecondary, borderColor: colors.border, color: colors.textPrimary }]}
                    value={bankDetails.accountNumber}
                    onChangeText={(text) => setBankDetails({ ...bankDetails, accountNumber: text })}
                    placeholder="Enter account number"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                  
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>IFSC Code</Text>
                  <TextInput
                    style={[styles.transferInput, { backgroundColor: colors.bgSecondary, borderColor: colors.border, color: colors.textPrimary }]}
                    value={bankDetails.ifscCode}
                    onChangeText={(text) => setBankDetails({ ...bankDetails, ifscCode: text.toUpperCase() })}
                    placeholder="Enter IFSC code"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                  />
                </View>
              )}

              {withdrawMethod === 'UPI' && (
                <View>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>UPI ID</Text>
                  <TextInput
                    style={[styles.transferInput, { backgroundColor: colors.bgSecondary, borderColor: colors.border, color: colors.textPrimary }]}
                    value={upiId}
                    onChangeText={setUpiId}
                    placeholder="Enter UPI ID (e.g., name@upi)"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                  />
                </View>
              )}

              <TouchableOpacity 
                style={[styles.withdrawSubmitBtn, { backgroundColor: colors.primary }, isTransferring && styles.btnDisabled]}
                onPress={handleWithdrawRequest}
                disabled={isTransferring}
              >
                {isTransferring ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.withdrawSubmitBtnText}>Submit Withdrawal Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Open New Account Modal */}
      <Modal visible={showOpenModal} animationType="slide" transparent onRequestClose={() => setShowOpenModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowOpenModal(false)} />
          <View style={[styles.transferModalContent, { backgroundColor: colors.bgCard, maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Open New Account</Text>
              <TouchableOpacity onPress={() => setShowOpenModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {groupsLoading ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: 30 }} />
            ) : groups.length === 0 ? (
              <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                <Ionicons name="alert-circle-outline" size={40} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginTop: 10, fontSize: 13 }}>No account types available</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 380 }}>
                {groups.map((g) => {
                  const selected = selectedGroupId === g.id;
                  return (
                    <TouchableOpacity
                      key={g.id}
                      onPress={() => setSelectedGroupId(g.id)}
                      activeOpacity={0.85}
                      style={{
                        borderRadius: 12,
                        borderWidth: selected ? 2 : 1,
                        borderColor: selected ? colors.accent : colors.border,
                        backgroundColor: selected ? colors.accent + '15' : colors.bgSecondary,
                        padding: 14,
                        marginBottom: 10,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>{g.name}</Text>
                          {g.description ? (
                            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }} numberOfLines={2}>
                              {g.description}
                            </Text>
                          ) : null}
                        </View>
                        {selected && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
                        <View>
                          <Text style={{ color: colors.textMuted, fontSize: 10 }}>Min Deposit</Text>
                          <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700', marginTop: 2 }}>${g.minimum_deposit ?? 0}</Text>
                        </View>
                        <View>
                          <Text style={{ color: colors.textMuted, fontSize: 10 }}>Leverage</Text>
                          <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700', marginTop: 2 }}>1:{g.leverage_default ?? 100}</Text>
                        </View>
                        <View>
                          <Text style={{ color: colors.textMuted, fontSize: 10 }}>Commission</Text>
                          <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700', marginTop: 2 }}>${g.commission_per_lot ?? 0}/lot</Text>
                        </View>
                        {g.swap_free ? (
                          <View>
                            <Text style={{ color: colors.textMuted, fontSize: 10 }}>Swap</Text>
                            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700', marginTop: 2 }}>Free</Text>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.transferSubmitBtn, (openingAccount || !selectedGroupId) && styles.btnDisabled]}
              onPress={handleOpenAccount}
              disabled={openingAccount || !selectedGroupId}
            >
              {openingAccount ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.transferSubmitBtnText}>Open Account</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Account Created — professional success popup */}
      <Modal visible={!!successAccount} animationType="fade" transparent onRequestClose={() => setSuccessAccount(null)}>
        <View style={styles.successOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSuccessAccount(null)} />
          <View style={[styles.successCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={[styles.successIconWrap, { backgroundColor: colors.accent + '1F', borderColor: colors.accent + '55' }]}>
              <Ionicons name="checkmark-circle" size={52} color={colors.accent} />
            </View>
            <Text style={[styles.successTitle, { color: colors.textPrimary }]}>Account Created</Text>
            <Text style={[styles.successSub, { color: colors.textMuted }]}>
              Your {successAccount?.is_demo ? 'demo' : 'new trading'} account is ready to use.
            </Text>

            <View style={[styles.successBox, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
              <View style={styles.successRow}>
                <Text style={[styles.successRowLab, { color: colors.textMuted }]}>Account No.</Text>
                <Text style={[styles.successRowVal, { color: colors.textPrimary, fontSize: 15, fontWeight: '800' }]}>
                  {successAccount?.account_number}
                </Text>
              </View>
              <View style={[styles.successDivider, { backgroundColor: colors.border }]} />
              <View style={styles.successRow}>
                <Text style={[styles.successRowLab, { color: colors.textMuted }]}>Type</Text>
                <Text style={[styles.successRowVal, { color: colors.textPrimary }]}>{successAccount?.type}</Text>
              </View>
              {successAccount?.leverage ? (
                <>
                  <View style={[styles.successDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.successRow}>
                    <Text style={[styles.successRowLab, { color: colors.textMuted }]}>Leverage</Text>
                    <Text style={[styles.successRowVal, { color: colors.textPrimary }]}>1:{successAccount.leverage}</Text>
                  </View>
                </>
              ) : null}
            </View>

            <TouchableOpacity style={styles.transferSubmitBtn} onPress={() => setSuccessAccount(null)}>
              <Text style={styles.transferSubmitBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Account to Account Transfer Modal */}
      <Modal visible={showAccountTransferModal} animationType="slide" transparent onRequestClose={() => setShowAccountTransferModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowAccountTransferModal(false)} />
          <View style={[styles.transferModalContent, { backgroundColor: colors.bgCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Transfer Between Accounts</Text>
              <TouchableOpacity onPress={() => setShowAccountTransferModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            
            <View style={[styles.transferInfo, { backgroundColor: colors.bgSecondary }]}>
              <View style={[styles.transferInfoRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.transferLabel, { color: colors.textMuted }]}>From</Text>
                <Text style={[styles.transferValue, { color: colors.textPrimary }]}>{selectedAccount?.accountId}</Text>
              </View>
              <View style={[styles.transferInfoRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.transferLabel, { color: colors.textMuted }]}>Available</Text>
                <Text style={[styles.transferValueGold, { color: colors.primary }]}>${(selectedAccount?.balance || 0).toFixed(2)}</Text>
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Select Target Account</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountsScroll}>
              {accounts.filter(a => a._id !== selectedAccount?._id).map(account => (
                <TouchableOpacity
                  key={account._id}
                  style={[styles.accountSelectCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }, targetAccount?._id === account._id && styles.accountSelectCardActive]}
                  onPress={() => setTargetAccount(account)}
                >
                  <Text style={[styles.accountSelectId, { color: colors.textPrimary }, targetAccount?._id === account._id && { color: '#fff' }]}>{account.accountId}</Text>
                  <Text style={[styles.accountSelectBalance, { color: colors.textMuted }]}>${(account.balance || 0).toFixed(2)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Amount (USD)</Text>
            <TextInput
              style={[styles.transferInput, { backgroundColor: colors.bgSecondary, borderColor: colors.border, color: colors.textPrimary }]}
              value={transferAmount}
              onChangeText={setTransferAmount}
              placeholder="Enter amount"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />

            <TouchableOpacity 
              style={[styles.transferSubmitBtn, { backgroundColor: colors.primary }, isTransferring && styles.btnDisabled]}
              onPress={handleAccountToAccountTransfer}
              disabled={isTransferring}
            >
              {isTransferring ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.transferSubmitBtnText}>Transfer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  accountCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  primaryCard: {
    borderColor: '#F26A1F',
    borderWidth: 2,
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F26A1F',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 4,
  },
  primaryBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  accountIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F26A1F20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountInfo: {
    flex: 1,
    marginLeft: 12,
  },
  accountId: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  accountType: {
    color: '#666',
    fontSize: 13,
    marginTop: 2,
  },
  balanceSection: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceItem: {
    alignItems: 'center',
  },
  balanceLabel: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
  },
  balanceValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  depositBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#F26A1F',
    borderRadius: 10,
  },
  depositBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  withdrawBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  withdrawBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  setPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 12,
  },
  setPrimaryBtnText: {
    color: '#F26A1F',
    fontSize: 14,
  },
  tradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#F26A1F',
    borderRadius: 10,
  },
  tradeBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
  openAccountBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Tabs Styles
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#F26A1F',
  },
  tabText: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  // Buy Challenge Styles
  buyChallengeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  buyChallengeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  walletBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1E1E1E',
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  walletBalanceLabel: {
    color: '#888',
    fontSize: 14,
  },
  walletBalanceValue: {
    color: '#F26A1F',
    fontSize: 16,
    fontWeight: 'bold',
  },
  challengesList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  challengeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginVertical: 6,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  challengeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F26A1F20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  challengeDesc: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  challengeDetails: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  challengeDetail: {
    color: '#666',
    fontSize: 11,
  },
  buyBtnSmall: {
    backgroundColor: '#F26A1F',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buyBtnSmallText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  // Challenge Account Styles
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  challengeProgress: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  progressLabel: {
    color: '#888',
    fontSize: 12,
  },
  progressValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  accountTypesList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  loadingTypes: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#666',
    marginTop: 12,
  },
  accountTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginVertical: 6,
    borderRadius: 12,
  },
  accountTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F26A1F20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accountTypeInfo: {
    flex: 1,
  },
  accountTypeName: {
    fontSize: 16,
    fontWeight: '600',
  },
  accountTypeDesc: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  accountTypeDetails: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  accountTypeDetail: {
    color: '#888',
    fontSize: 11,
  },
  backToTypesBtn: {
    flex: 1,
    backgroundColor: '#333',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  backToTypesBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createAccountBtn: {
    flex: 1,
    backgroundColor: '#F26A1F',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createAccountBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  
  // Transfer Modal Styles
  transferModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  successOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: 'center',
  },
  successIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  successSub: { fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 18 },
  successBox: {
    width: '100%',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginTop: 20,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  successRowLab: { fontSize: 12 },
  successRowVal: { fontSize: 14, fontWeight: '700' },
  successDivider: { height: StyleSheet.hairlineWidth, width: '100%' },
  transferInfo: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  transferInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  transferLabel: {
    color: '#888',
    fontSize: 14,
  },
  transferValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  transferValueGold: {
    color: '#F26A1F',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
    marginTop: 8,
  },
  transferInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
  },
  transferSubmitBtn: {
    backgroundColor: '#F26A1F',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  transferSubmitBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  withdrawSubmitBtn: {
    backgroundColor: '#F26A1F',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  withdrawSubmitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  accountsScroll: {
    marginVertical: 8,
  },
  accountSelectCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 10,
    alignItems: 'center',
    minWidth: 100,
    borderWidth: 1,
  },
  accountSelectCardActive: {
    backgroundColor: '#F26A1F',
    borderColor: '#F26A1F',
  },
  accountSelectId: {
    fontSize: 14,
    fontWeight: '600',
  },
  accountSelectBalance: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  // Wallet Card Styles
  walletCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  walletIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  walletInfo: {
    flex: 1,
  },
  walletTitle: {
    fontSize: 12,
    marginBottom: 2,
  },
  walletBalanceText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  walletWithdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  walletWithdrawBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Method Selection Styles
  methodRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  methodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  methodBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AccountsScreen;
