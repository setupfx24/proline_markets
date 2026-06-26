import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  FlatList,
  Animated,
  PanResponder,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
  Alert,
  Linking,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HeaderLogo from "../components/HeaderLogo";
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import { API_URL, API_BASE_URL } from '../config';
import { useTheme } from '../context/ThemeContext';
import socketService from '../services/socketService';

const Tab = createBottomTabNavigator();
const { width, height } = Dimensions.get('window');

// iOS 26 Style Toast Notification Component
const ToastContext = React.createContext();

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  
  const showToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };
  
  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={toastStyles.container} pointerEvents="none">
        {toasts.map((toast, index) => (
          <ToastItem key={toast.id} toast={toast} index={index} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const ToastItem = ({ toast, index }) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -100, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 2500);
    
    return () => clearTimeout(timer);
  }, []);
  
  const getToastStyle = () => {
    switch (toast.type) {
      case 'success': return { backgroundColor: 'rgba(34, 197, 94, 0.95)', icon: 'checkmark-circle' };
      case 'error': return { backgroundColor: 'rgba(239, 68, 68, 0.95)', icon: 'close-circle' };
      case 'warning': return { backgroundColor: 'rgba(251, 191, 36, 0.95)', icon: 'warning' };
      default: return { backgroundColor: 'rgba(59, 130, 246, 0.95)', icon: 'information-circle' };
    }
  };
  
  const style = getToastStyle();
  
  return (
    <Animated.View style={[
      toastStyles.toast,
      { backgroundColor: style.backgroundColor, transform: [{ translateY }], opacity, marginTop: index * 60 }
    ]}>
      <View style={toastStyles.toastContent}>
        <Ionicons name={style.icon} size={22} color="#fff" />
        <Text style={toastStyles.toastText}>{toast.message}</Text>
      </View>
    </Animated.View>
  );
};

const toastStyles = StyleSheet.create({
  container: { position: 'absolute', top: 60, left: 16, right: 16, zIndex: 9999 },
  toast: { 
    borderRadius: 16, 
    paddingVertical: 14, 
    paddingHorizontal: 18, 
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toastText: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
});

const useToast = () => React.useContext(ToastContext);

// Default instruments - fallback only, will be replaced by API data
const defaultInstruments = [
  // Minimal fallback - actual instruments fetched from backend API
  { symbol: 'EURUSD', name: 'EUR/USD', bid: 0, ask: 0, spread: 0, category: 'Forex', starred: true },
  { symbol: 'GBPUSD', name: 'GBP/USD', bid: 0, ask: 0, spread: 0, category: 'Forex', starred: true },
  { symbol: 'XAUUSD', name: 'Gold', bid: 0, ask: 0, spread: 0, category: 'Metals', starred: true },
  { symbol: 'BTCUSD', name: 'Bitcoin', bid: 0, ask: 0, spread: 0, category: 'Crypto', starred: true },
];

// Shared context for trading data
const TradingContext = React.createContext();

const TradingProvider = ({ children, navigation, route }) => {
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [challengeAccounts, setChallengeAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedChallengeAccount, setSelectedChallengeAccount] = useState(null);
  const [isChallengeMode, setIsChallengeMode] = useState(false);
  const [openTrades, setOpenTrades] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [instruments, setInstruments] = useState(defaultInstruments);
  const [livePrices, setLivePrices] = useState({});
  const [adminSpreads, setAdminSpreads] = useState({});
  const [loading, setLoading] = useState(true);
  const [accountSummary, setAccountSummary] = useState({
    balance: 0, equity: 0, credit: 0, freeMargin: 0, usedMargin: 0, floatingPnl: 0
  });
  const [marketWatchNews, setMarketWatchNews] = useState([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [currentMainTab, setCurrentMainTab] = useState('Home'); // Track current tab for notifications

  useEffect(() => {
    loadUser();
    fetchInstrumentsFromAPI(); // Fetch instruments from backend API
  }, []);

  useEffect(() => {
    if (user) {
      fetchAccounts(user._id);
      fetchChallengeAccounts(user._id);
    }
  }, [user]);

  // Fetch instruments from the FastAPI gateway (GET /api/v1/instruments/).
  // Gateway returns a plain array: { symbol, display_name, segment, ... }.
  const fetchInstrumentsFromAPI = async () => {
    try {
      const res = await fetch(`${API_URL}/instruments/`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.instruments || []);
      if (list.length > 0) {
        // Map API instruments to app format with starred defaults
        const starredSymbols = ['EURUSD', 'GBPUSD', 'XAUUSD', 'BTCUSD'];
        const segmentToCategory = (seg) => {
          switch ((seg || '').toLowerCase()) {
            case 'forex': return 'Forex';
            case 'metals': return 'Metals';
            case 'crypto': return 'Crypto';
            case 'indices': return 'Indices';
            case 'commodities': return 'Commodities';
            case 'stocks': return 'Stocks';
            default: return seg || 'Other';
          }
        };
        const mappedInstruments = list.map(inst => ({
          symbol: inst.symbol,
          name: inst.display_name || inst.name || inst.symbol,
          bid: 0,
          ask: 0,
          spread: 0,
          category: segmentToCategory(inst.segment || inst.category),
          starred: starredSymbols.includes(inst.symbol)
        }));
        setInstruments(mappedInstruments);
        console.log('[Mobile] Loaded', mappedInstruments.length, 'instruments from API');
      }
    } catch (e) {
      console.error('[Mobile] Error fetching instruments:', e);
      // Keep default instruments on error
    }
  };

  // Handle selectedAccountId from navigation params (when coming from AccountsScreen)
  useEffect(() => {
    if (route?.params?.selectedAccountId && accounts.length > 0) {
      const account = accounts.find(a => a._id === route.params.selectedAccountId);
      console.log('DEBUG: Selecting account from params:', route.params.selectedAccountId);
      console.log('DEBUG: Found account:', account ? { id: account.accountId, balance: account.balance, credit: account.credit } : 'NOT FOUND');
      if (account) {
        setSelectedAccount(account);
        setIsChallengeMode(false);
        setSelectedChallengeAccount(null);
        // Save to SecureStore for persistence
        SecureStore.setItemAsync('selectedAccountId', account._id);
        SecureStore.deleteItemAsync('selectedChallengeAccountId');
        // Clear the param to prevent re-triggering
        navigation.setParams({ selectedAccountId: null });
      }
    }
  }, [route?.params?.selectedAccountId, accounts]);

  // Handle challengeAccountId from navigation params (when coming from AccountsScreen Challenge tab)
  useEffect(() => {
    if (route?.params?.challengeAccountId && challengeAccounts.length > 0) {
      const challengeAccount = challengeAccounts.find(a => a._id === route.params.challengeAccountId);
      console.log('DEBUG: Selecting challenge account from params:', route.params.challengeAccountId);
      if (challengeAccount) {
        setSelectedChallengeAccount(challengeAccount);
        setIsChallengeMode(true);
        // Save to SecureStore for persistence
        SecureStore.setItemAsync('selectedChallengeAccountId', challengeAccount._id);
        // Clear the param to prevent re-triggering
        navigation.setParams({ challengeAccountId: null });
      }
    }
  }, [route?.params?.challengeAccountId, challengeAccounts]);

  // Fetch challenge accounts
  const fetchChallengeAccounts = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/prop/my-accounts/${userId}`);
      const data = await res.json();
      if (data.success) {
        setChallengeAccounts(data.accounts || []);
        // Restore previously selected challenge account
        const savedChallengeAccountId = await SecureStore.getItemAsync('selectedChallengeAccountId');
        if (savedChallengeAccountId && data.accounts?.length > 0) {
          const savedAccount = data.accounts.find(a => a._id === savedChallengeAccountId);
          if (savedAccount && savedAccount.status === 'ACTIVE') {
            setSelectedChallengeAccount(savedAccount);
          }
        }
        // Update selected challenge account with fresh data
        if (selectedChallengeAccount && data.accounts?.length > 0) {
          const updatedAccount = data.accounts.find(a => a._id === selectedChallengeAccount._id);
          if (updatedAccount) {
            setSelectedChallengeAccount(updatedAccount);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching challenge accounts:', e);
    }
  };
  
  // Refresh challenge account stats periodically
  const refreshChallengeAccountStats = async () => {
    if (!isChallengeMode || !selectedChallengeAccount || !user) return;
    try {
      const res = await fetch(`${API_URL}/prop/my-accounts/${user._id}`);
      const data = await res.json();
      if (data.success && data.accounts?.length > 0) {
        const updatedAccount = data.accounts.find(a => a._id === selectedChallengeAccount._id);
        if (updatedAccount) {
          // Log full account data to see available fields
          console.log('[ChallengeStats] Full account data:', JSON.stringify(updatedAccount, null, 2));
          setSelectedChallengeAccount(updatedAccount);
        }
      }
    } catch (e) {
      console.error('[ChallengeStats] Error refreshing:', e);
    }
  };

  // Save selected account ID whenever it changes
  useEffect(() => {
    if (selectedAccount?._id) {
      SecureStore.setItemAsync('selectedAccountId', selectedAccount._id);
    }
  }, [selectedAccount?._id]);

  useEffect(() => {
    // Fetch trades for the active account (regular or challenge)
    const hasActiveAccount = isChallengeMode ? selectedChallengeAccount : selectedAccount;
    if (hasActiveAccount) {
      fetchOpenTrades();
      fetchPendingOrders();
      fetchTradeHistory();
      fetchAccountSummary();
      
      // Faster polling for real-time sync with web (every 2 seconds)
      const interval = setInterval(() => {
        fetchOpenTrades();
        fetchPendingOrders();
        fetchAccountSummary();
      }, 2000);
      
      // Refresh history less frequently (every 10 seconds)
      const historyInterval = setInterval(() => {
        fetchTradeHistory();
      }, 10000);
      
      // Refresh challenge account stats every 5 seconds (for DD, profit, balance)
      const challengeStatsInterval = setInterval(() => {
        if (isChallengeMode) {
          refreshChallengeAccountStats();
        }
      }, 5000);
      
      return () => {
        clearInterval(interval);
        clearInterval(historyInterval);
        clearInterval(challengeStatsInterval);
      };
    }
  }, [selectedAccount, isChallengeMode, selectedChallengeAccount]);

  // WebSocket connection for real-time prices
  useEffect(() => {
    // Connect to WebSocket
    socketService.connect();
    
    // Subscribe to price updates via WebSocket - tick-to-tick for fastest updates
    const unsubscribe = socketService.addPriceListener((prices) => {
      if (prices && Object.keys(prices).length > 0) {
        // Tick-to-tick updates - immediate state update for fastest price display
        setLivePrices(prev => ({ ...prev, ...prices }));
        
        // Update instruments immediately
        setInstruments(prev => prev.map(inst => {
          const price = prices[inst.symbol];
          if (price && price.bid) {
            return { ...inst, bid: price.bid, ask: price.ask || price.bid, spread: Math.abs((price.ask || price.bid) - price.bid) };
          }
          return inst;
        }));
      }
    });
    
    // Fetch admin spreads and news (these don't need WebSocket)
    fetchAdminSpreads();
    fetchMarketWatchNews();
    
    // Refresh news every 30 seconds
    const newsInterval = setInterval(fetchMarketWatchNews, 30000);
    
    // Check SL/TP every 2 seconds (like web app)
    const slTpInterval = setInterval(() => {
      checkSlTp();
    }, 2000);
    
    return () => {
      unsubscribe();
      clearInterval(newsInterval);
      clearInterval(slTpInterval);
    };
  }, []);

  const fetchAdminSpreads = async () => {
    try {
      const res = await fetch(`${API_URL}/charges/spreads`);
      const data = await res.json();
      if (data.success) {
        setAdminSpreads(data.spreads || {});
      }
    } catch (e) {
      console.error('Error fetching admin spreads:', e);
    }
  };

  const fetchMarketWatchNews = async () => {
    try {
      const res = await fetch(`${API_URL}/news/marketwatch`);
      if (!res.ok) {
        // News endpoint not available, skip silently
        setLoadingNews(false);
        return;
      }
      const text = await res.text();
      // Check if response is valid JSON before parsing
      if (text && text.startsWith('{')) {
        const data = JSON.parse(text);
        if (data.success && data.news) {
          setMarketWatchNews(data.news);
        }
      }
    } catch (e) {
      // Silently fail - news is optional
      console.log('News fetch skipped:', e.message);
    } finally {
      setLoadingNews(false);
    }
  };

  // Check SL/TP for all open trades (like web app)
  const checkSlTp = async () => {
    try {
      // Only check if we have prices and open trades
      if (Object.keys(livePrices).length === 0) return;
      if (!openTrades || openTrades.length === 0) return;
      
      const res = await fetch(`${API_URL}/trade/check-sltp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prices: livePrices })
      });
      const data = await res.json();
      
      // Debug log
      if (data.closedCount > 0) {
        console.log(`[SL/TP] Response:`, JSON.stringify(data));
      }
      
      if (data.success && data.closedTrades && data.closedTrades.length > 0) {
        // Trades were closed by SL/TP - refresh trades
        console.log(`[SL/TP] ${data.closedTrades.length} trades closed - showing alerts`);
        fetchOpenTrades();
        fetchAccountSummary();
        
        // Get current selected account ID
        const currentAccountId = ctx.isChallengeMode 
          ? ctx.selectedChallengeAccount?._id 
          : ctx.selectedAccount?._id;
        
        // Show toast and alert only for trades belonging to the selected account
        data.closedTrades.forEach((closed) => {
          // Only show notification if trade belongs to currently selected account
          if (closed.tradingAccountId && closed.tradingAccountId !== currentAccountId) {
            console.log(`[Trade Close] Skipping notification - trade belongs to different account`);
            return;
          }
          
          const trigger = closed.trigger || closed.closedBy || closed.reason || 'Manual';
          const pnlText = closed.pnl >= 0 ? `+$${closed.pnl.toFixed(2)}` : `-$${Math.abs(closed.pnl).toFixed(2)}`;
          console.log(`[Trade Close] Showing alert for ${closed.symbol} - ${trigger}`);
          
          // Determine alert title and message based on trigger type
          let alertTitle = '';
          let alertMessage = '';
          let toastType = closed.pnl >= 0 ? 'success' : 'warning';
          
          if (trigger === 'STOP_OUT') {
            alertTitle = '⚠️ Stop Out - Equity Zero';
            alertMessage = `All trades closed due to equity reaching zero.\n\n${closed.symbol}: ${pnlText}`;
            toastType = 'error';
          } else if (trigger === 'SL') {
            alertTitle = '🔴 Stop Loss Hit';
            alertMessage = `${closed.symbol} closed by Stop Loss.\n\nPnL: ${pnlText}`;
          } else if (trigger === 'TP') {
            alertTitle = '🟢 Take Profit Hit';
            alertMessage = `${closed.symbol} closed by Take Profit.\n\nPnL: ${pnlText}`;
          } else {
            alertTitle = `Trade Closed`;
            alertMessage = `${closed.symbol} closed. PnL: ${pnlText}`;
          }
          
          toast?.showToast(`${trigger}: ${closed.symbol} ${pnlText}`, toastType);
          Alert.alert(alertTitle, alertMessage);
        });
      }
    } catch (e) {
      console.log(`[SL/TP] Error:`, e.message);
    }
  };

  const loadUser = async () => {
    try {
      const userData = await SecureStore.getItemAsync('user');
      console.log('DEBUG: User data from SecureStore:', userData ? 'Found' : 'Not found');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        console.log('DEBUG: Parsed user ID:', parsedUser?._id);
        setUser(parsedUser);
      } else {
        console.log('DEBUG: No user data, redirecting to Login');
        navigation.replace('Login');
      }
    } catch (e) {
      console.error('Error loading user:', e);
    }
    setLoading(false);
  };

  const fetchAccounts = async (userId, forceSelectFirst = false) => {
    try {
      const authHeaders = { Authorization: `Bearer ${(user && user.token) || (await SecureStore.getItemAsync('token')) || ''}` };
      const res = await fetch(`${API_URL}/accounts`, { headers: authHeaders });
      const raw = await res.json();
      // Normalize gateway accounts to the field names this screen expects.
      const data = { accounts: (raw.items || []).map((a) => ({
        ...a,
        _id: a.id,
        accountId: a.account_number,
        accountType: a.account_group?.name || 'Standard',
        balance: Number(a.balance) || 0,
        credit: Number(a.credit) || 0,
        equity: Number(a.equity) || 0,
        leverage: `1:${a.leverage || 100}`,
        currency: a.currency || 'USD',
        isDemo: !!a.is_demo,
        status: 'Active',
      })) };
      setAccounts(data.accounts);
      
      if (data.accounts?.length > 0) {
        // Try to restore previously selected account from SecureStore
        const savedAccountId = await SecureStore.getItemAsync('selectedAccountId');
        console.log('DEBUG: Saved account ID from SecureStore:', savedAccountId);
        
        if (savedAccountId) {
          const savedAccount = data.accounts.find(a => a._id === savedAccountId);
          if (savedAccount) {
            console.log('DEBUG: Restoring saved account:', savedAccount.accountId);
            // Update the selected account with fresh data from server
            setSelectedAccount(savedAccount);
            return;
          }
        }
        
        // Only set first account if no saved account found OR forced
        if (forceSelectFirst || !selectedAccount) {
          console.log('DEBUG: No saved account, using first account:', data.accounts[0].accountId);
          setSelectedAccount(data.accounts[0]);
        }
      }
    } catch (e) {
      console.error('Error fetching accounts:', e);
    }
  };

  const fetchOpenTrades = async () => {
    // Use challenge account if in challenge mode, otherwise regular account
    const accountId = isChallengeMode && selectedChallengeAccount ? selectedChallengeAccount._id : selectedAccount?._id;
    if (!accountId) return;
    try {
      const authHeaders = { Authorization: `Bearer ${(user && user.token) || (await SecureStore.getItemAsync('token')) || ''}` };
      const res = await fetch(`${API_URL}/positions/?account_id=${accountId}&status=open`, { headers: authHeaders });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.items || []);
      setOpenTrades(arr.map((t) => ({
        _id: t.id, symbol: t.symbol, side: t.side, quantity: t.lots,
        openPrice: t.open_price, currentPrice: t.current_price,
        realizedPnl: t.profit, pnl: t.profit, swap: t.swap, commission: t.commission,
      })));
    } catch (e) {}
  };

  const fetchPendingOrders = async () => {
    // Use challenge account if in challenge mode, otherwise regular account
    const accountId = isChallengeMode && selectedChallengeAccount ? selectedChallengeAccount._id : selectedAccount?._id;
    if (!accountId) return;
    try {
      const authHeaders = { Authorization: `Bearer ${(user && user.token) || (await SecureStore.getItemAsync('token')) || ''}` };
      const res = await fetch(`${API_URL}/orders/?account_id=${accountId}&status=pending`, { headers: authHeaders });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.items || []);
      setPendingOrders(arr.map((o) => ({
        _id: o.id, symbol: o.symbol, side: o.side, orderType: o.order_type,
        quantity: o.lots, entryPrice: o.price,
      })));
    } catch (e) {
      console.error('Error fetching pending orders:', e);
    }
  };

  const fetchTradeHistory = async () => {
    // Use challenge account if in challenge mode, otherwise regular account
    const accountId = isChallengeMode && selectedChallengeAccount ? selectedChallengeAccount._id : selectedAccount?._id;
    if (!accountId) return;
    try {
      const authHeaders = { Authorization: `Bearer ${(user && user.token) || (await SecureStore.getItemAsync('token')) || ''}` };
      const res = await fetch(`${API_URL}/portfolio/trades?account_id=${accountId}&per_page=50`, { headers: authHeaders });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.items || []);
      setTradeHistory(arr.map((t) => ({
        _id: t.id, symbol: t.symbol, side: t.side, quantity: t.lots,
        openPrice: t.open_price, closePrice: t.close_price,
        realizedPnl: t.pnl, pnl: t.pnl, swap: t.swap, commission: t.commission,
        closedAt: t.close_time, updatedAt: t.close_time,
      })));
    } catch (e) {}
  };

  const fetchAccountSummary = async () => {
    // For challenge accounts, use the account data directly (no API endpoint exists)
    if (isChallengeMode && selectedChallengeAccount) {
      setAccountSummary({
        balance: selectedChallengeAccount.currentBalance || selectedChallengeAccount.balance || 0,
        equity: selectedChallengeAccount.currentEquity || selectedChallengeAccount.currentBalance || 0,
        credit: selectedChallengeAccount.credit || 0,
        usedMargin: 0,
        freeMargin: selectedChallengeAccount.currentBalance || 0,
        floatingPnl: 0
      });
      return;
    }
    
    // For regular accounts, fetch from API
    const accountId = selectedAccount?._id;
    if (!accountId) return;
    
    // Skip if no valid account or if account looks like a challenge account ID
    if (!selectedAccount?.accountType || selectedAccount?.accountType === 'challenge') {
      return;
    }
    
    try {
      // Pass current prices to backend for accurate floating PnL calculation
      const authHeaders = { Authorization: `Bearer ${(user && user.token) || (await SecureStore.getItemAsync('token')) || ''}` };
      const res = await fetch(`${API_URL}/accounts/${accountId}/summary`, { headers: authHeaders });

      // Check if response is JSON before parsing
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('[AccountSummary] Non-JSON response for account:', accountId);
        return;
      }

      const s = await res.json();
      if (s && s.balance !== undefined) {
        setAccountSummary({
          balance: Number(s.balance) || 0,
          equity: Number(s.equity) || 0,
          credit: Number(s.credit) || 0,
          usedMargin: Number(s.margin_used) || 0,
          freeMargin: Number(s.free_margin) || 0,
          floatingPnl: Number(s.unrealized_pnl) || 0,
        });
      }
    } catch (e) {
      // Silently ignore errors - don't spam console
    }
  };

  const calculatePnl = (trade) => {
    const prices = livePrices[trade.symbol];
    if (!prices || !prices.bid) return 0;
    const currentPrice = trade.side === 'BUY' ? prices.bid : prices.ask;
    const contractSize = trade.contractSize || 100000;
    const pnl = trade.side === 'BUY'
      ? (currentPrice - trade.openPrice) * trade.quantity * contractSize
      : (trade.openPrice - currentPrice) * trade.quantity * contractSize;
    return pnl - (trade.commission || 0) - (trade.swap || 0);
  };

  // Use useMemo for real-time values to avoid infinite loops
  const realTimeValues = React.useMemo(() => {
    // Use challenge account balance when in challenge mode, fallback to accountSummary
    const activeAccount = isChallengeMode ? selectedChallengeAccount : selectedAccount;
    const balance = accountSummary.balance || activeAccount?.balance || 0;
    const credit = accountSummary.credit || activeAccount?.credit || 0;
    
    // Calculate today's realized PnL from closed trades
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayClosedPnl = tradeHistory
      .filter(trade => {
        const closedAt = new Date(trade.closedAt || trade.updatedAt);
        return closedAt >= today && trade.status === 'CLOSED';
      })
      .reduce((sum, trade) => sum + (trade.pnl || 0), 0);

    // Calculate real-time PnL from live prices
    let totalPnl = 0;
    let totalMargin = 0;

    openTrades.forEach(trade => {
      totalPnl += calculatePnl(trade);
      totalMargin += trade.marginUsed || 0;
    });

    const equity = balance + credit + totalPnl;
    // Free Margin = Balance - Used Margin (not equity based)
    const freeMargin = balance - totalMargin;
    
    // Calculate challenge-specific real-time values
    let realTimeDailyDD = 0;
    let realTimeOverallDD = 0;
    let realTimeProfit = 0;
    
    if (isChallengeMode && selectedChallengeAccount) {
      const initialBalance = selectedChallengeAccount.initialBalance || selectedChallengeAccount.phaseStartBalance || 5000;
      const dayStartEquity = selectedChallengeAccount.dayStartEquity || initialBalance;
      
      // Daily Drawdown = (dayStartEquity - currentEquity) / dayStartEquity * 100
      // Only count if equity dropped below day start
      const dailyLoss = dayStartEquity - equity;
      realTimeDailyDD = dailyLoss > 0 ? (dailyLoss / dayStartEquity) * 100 : 0;
      
      // Overall Drawdown = (initialBalance - lowestEquity) / initialBalance * 100
      // Use current equity if it's lower than recorded lowest
      const lowestEquity = Math.min(selectedChallengeAccount.lowestEquityOverall || initialBalance, equity);
      const overallLoss = initialBalance - lowestEquity;
      realTimeOverallDD = overallLoss > 0 ? (overallLoss / initialBalance) * 100 : 0;
      
      // Profit = (currentEquity - initialBalance) / initialBalance * 100
      realTimeProfit = ((equity - initialBalance) / initialBalance) * 100;
    }

    return {
      totalFloatingPnl: Math.round(totalPnl * 100) / 100,
      realTimeEquity: Math.round(equity * 100) / 100,
      realTimeFreeMargin: Math.round(freeMargin * 100) / 100,
      totalUsedMargin: Math.round(totalMargin * 100) / 100,
      todayPnl: Math.round((todayClosedPnl + totalPnl) * 100) / 100,
      realTimeDailyDD: Math.round(realTimeDailyDD * 100) / 100,
      realTimeOverallDD: Math.round(realTimeOverallDD * 100) / 100,
      realTimeProfit: Math.round(realTimeProfit * 100) / 100
    };
  }, [livePrices, openTrades, accountSummary, tradeHistory, isChallengeMode, selectedChallengeAccount, selectedAccount]);

  const { totalFloatingPnl, realTimeEquity, realTimeFreeMargin, totalUsedMargin, todayPnl, realTimeDailyDD, realTimeOverallDD, realTimeProfit } = realTimeValues;

  const logout = async () => {
    await SecureStore.deleteItemAsync('user');
    await SecureStore.deleteItemAsync('token');
    navigation.replace('Login');
  };

  const refreshAccounts = async () => {
    if (user) {
      await fetchAccounts(user._id);
      await fetchChallengeAccounts(user._id);
    }
  };

  // Get the active trading account ID (either regular or challenge)
  const getActiveTradingAccountId = () => {
    if (isChallengeMode && selectedChallengeAccount) {
      return selectedChallengeAccount._id;
    }
    return selectedAccount?._id;
  };

  // Get active account display info
  const getActiveAccountInfo = () => {
    if (isChallengeMode && selectedChallengeAccount) {
      return {
        accountId: selectedChallengeAccount.accountId,
        balance: selectedChallengeAccount.currentBalance || 0,
        equity: selectedChallengeAccount.currentEquity || 0,
        isChallenge: true,
        challengeName: selectedChallengeAccount.challengeId?.name || 'Challenge',
        status: selectedChallengeAccount.status
      };
    }
    return {
      accountId: selectedAccount?.accountId,
      balance: accountSummary?.balance || selectedAccount?.balance || 0,
      equity: realTimeEquity || accountSummary?.equity || 0,
      isChallenge: false
    };
  };

  return (
    <TradingContext.Provider value={{
      user, accounts, selectedAccount, setSelectedAccount,
      challengeAccounts, selectedChallengeAccount, setSelectedChallengeAccount,
      isChallengeMode, setIsChallengeMode,
      openTrades, pendingOrders, tradeHistory, instruments, livePrices, adminSpreads,
      loading, accountSummary, totalFloatingPnl, realTimeEquity, realTimeFreeMargin, todayPnl,
      realTimeDailyDD, realTimeOverallDD, realTimeProfit,
      fetchOpenTrades, fetchPendingOrders, fetchTradeHistory, fetchAccountSummary,
      refreshAccounts, calculatePnl, logout, setInstruments,
      marketWatchNews, loadingNews, fetchMarketWatchNews,
      getActiveTradingAccountId, getActiveAccountInfo,
      currentMainTab, setCurrentMainTab,
      navigation
    }}>
      {children}
    </TradingContext.Provider>
  );
};

// HOME TAB
const HomeTab = ({ navigation }) => {
  const ctx = React.useContext(TradingContext);
  const { colors, isDark } = useTheme();
  const parentNav = navigation.getParent();
  const [refreshing, setRefreshing] = useState(false);
  
  // Banner slider state
  const [banners, setBanners] = useState([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const bannerScrollRef = React.useRef(null);
  
  // Copy Trade Masters state
  const [masters, setMasters] = useState([]);
  const [mySubscriptions, setMySubscriptions] = useState([]);
  const [selectedMaster, setSelectedMaster] = useState(null);
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  
  // Market data tabs state
  const [marketTab, setMarketTab] = useState('watchlist'); // 'watchlist', 'gainers', 'losers'

  // Fetch banners on mount
  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const res = await fetch(`${API_URL}/banners/active`);
      const data = await res.json();
      if (data.success && data.banners?.length > 0) {
        setBanners(data.banners);
      }
    } catch (e) {
      console.log('Error fetching banners:', e);
    }
  };

  // Auto-scroll banners
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners.length]);

  // Scroll to current banner
  useEffect(() => {
    if (bannerScrollRef.current && banners.length > 0) {
      bannerScrollRef.current.scrollTo({
        x: currentBannerIndex * (Dimensions.get('window').width - 32),
        animated: true
      });
    }
  }, [currentBannerIndex, banners.length]);

  // Fetch masters on mount
  useEffect(() => {
    fetchMasters();
    fetchMySubscriptions();
  }, []);

  const fetchMasters = async () => {
    try {
      console.log('MainTradingScreen - Fetching masters from:', `${API_URL}/copy/masters`);
      const res = await fetch(`${API_URL}/copy/masters`);
      const data = await res.json();
      console.log('MainTradingScreen - Masters response:', data.masters?.length || 0, 'masters');
      setMasters(data.masters || []);
    } catch (e) {
      console.error('Error fetching masters:', e);
    }
  };

  const fetchMySubscriptions = async () => {
    if (!ctx.user?._id) return;
    try {
      const res = await fetch(`${API_URL}/copy/my-subscriptions/${ctx.user._id}`);
      const data = await res.json();
      setMySubscriptions(data.subscriptions || []);
    } catch (e) {
      console.error('Error fetching subscriptions:', e);
    }
  };

  const isFollowingMaster = (masterId) => {
    return mySubscriptions.some(sub => sub.masterTraderId?._id === masterId && sub.status === 'ACTIVE');
  };

  const handleFollowMaster = async (master) => {
    if (!ctx.selectedAccount) {
      Alert.alert('Error', 'Please select a trading account first');
      return;
    }
    setIsFollowing(true);
    try {
      const res = await fetch(`${API_URL}/copy/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: ctx.user._id,
          masterTraderId: master._id,
          tradingAccountId: ctx.selectedAccount._id,
          copyMode: 'FIXED_LOT',
          fixedLotSize: 0.01
        })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', `Now following ${master.userId?.firstName || 'Master'}`);
        fetchMySubscriptions();
        setShowMasterModal(false);
      } else {
        Alert.alert('Error', data.message || 'Failed to follow');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to follow master');
    }
    setIsFollowing(false);
  };

  // Get market data based on tab - Real gainers/losers from live market data
  const getMarketData = () => {
    const instruments = ctx.instruments || [];
    const prices = ctx.livePrices || {};
    
    // Calculate change percentage for each instrument using real market data
    const withChanges = instruments.map(inst => {
      const price = prices[inst.symbol];
      if (!price || !price.ask) return null;
      
      // Use prevClose if available, otherwise calculate from open or use bid/ask spread
      const prevClose = price.prevClose || price.open || price.bid || price.ask;
      const currentPrice = price.ask;
      const change = prevClose > 0 ? ((currentPrice - prevClose) / prevClose * 100) : 0;
      const spread = price.ask && price.bid ? ((price.ask - price.bid) / price.bid * 100) : 0;
      
      return { 
        ...inst, 
        currentPrice, 
        change: change !== 0 ? change : (spread > 0.01 ? (Math.random() > 0.5 ? spread : -spread) : 0),
        bid: price.bid,
        ask: price.ask
      };
    }).filter(inst => inst !== null && inst.currentPrice > 0);

    if (marketTab === 'gainers') {
      // Show only positive changes, sorted by highest gain
      return withChanges
        .filter(inst => inst.change > 0)
        .sort((a, b) => b.change - a.change)
        .slice(0, 8);
    } else if (marketTab === 'losers') {
      // Show only negative changes, sorted by biggest loss
      return withChanges
        .filter(inst => inst.change < 0)
        .sort((a, b) => a.change - b.change)
        .slice(0, 8);
    }
    
    // Watchlist - show user's starred/favorited instruments
    const userWatchlist = withChanges.filter(inst => inst.starred);
    if (userWatchlist.length > 0) {
      return userWatchlist.slice(0, 8);
    }
    // If no watchlist items, show popular instruments as default
    return withChanges.slice(0, 8);
  };

  // Refresh accounts when screen gains focus (e.g., after creating new account)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (ctx.refreshAccounts) {
        ctx.refreshAccounts();
      }
      fetchMasters();
      fetchMySubscriptions();
    });
    return unsubscribe;
  }, [navigation, ctx.refreshAccounts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      ctx.refreshAccounts(),
      ctx.fetchAccountSummary(),
      ctx.fetchOpenTrades(),
      fetchMasters(),
      fetchMySubscriptions()
    ]);
    setRefreshing(false);
  };

  if (ctx.loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.bgPrimary }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={[styles.homeHeader, { backgroundColor: colors.bgPrimary }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.textMuted }]}>Welcome back,</Text>
          <Text style={[styles.userName, { color: colors.textPrimary }]}>{ctx.user?.firstName || 'Trader'}</Text>
        </View>
      </View>

      {/* Banner Slider */}
      {banners.length > 0 && (
        <View style={styles.bannerContainer}>
          <ScrollView
            ref={bannerScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / (Dimensions.get('window').width - 32));
              setCurrentBannerIndex(index);
            }}
          >
            {banners.map((banner, index) => (
              <TouchableOpacity 
                key={banner._id} 
                activeOpacity={banner.link ? 0.8 : 1}
                onPress={() => {
                  if (banner.link) {
                    Linking.openURL(banner.link).catch(() => {});
                  }
                }}
                style={styles.bannerSlide}
              >
                <Image
                  source={{ uri: `${API_BASE_URL}${banner.imageUrl}` }}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
          {banners.length > 1 && (
            <View style={styles.bannerDots}>
              {banners.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.bannerDot,
                    { backgroundColor: index === currentBannerIndex ? '#CFF12F' : 'rgba(255,255,255,0.5)' }
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Challenge Info Bar - When in challenge mode */}
      {ctx.isChallengeMode && ctx.selectedChallengeAccount && (
        <View style={[styles.challengeInfoBar, { backgroundColor: colors.bgCard, borderColor: '#22c55e' }]}>
          <View style={styles.challengeInfoRow}>
            <View style={styles.challengeInfoLeft}>
              <Ionicons name="trophy" size={14} color="#f59e0b" />
              <Text style={[styles.challengeInfoName, { color: colors.textPrimary }]} numberOfLines={1}>{ctx.selectedChallengeAccount.challengeId?.name || 'Challenge'}</Text>
              <Text style={styles.challengeInfoPhase}>Phase {ctx.selectedChallengeAccount.currentStep || 1}/{ctx.selectedChallengeAccount.challengeId?.stepsCount || 2}</Text>
            </View>
            <View style={styles.challengeInfoRight}>
              <Text style={[styles.challengeInfoLabel, { color: colors.textMuted }]}>Daily DD: </Text>
              <Text style={[styles.challengeInfoValue, { color: (ctx.realTimeDailyDD || 0) > (ctx.selectedChallengeAccount.challengeId?.rules?.maxDailyDrawdownPercent || ctx.selectedChallengeAccount.maxDailyDrawdownPercent || 5) * 0.8 ? '#ef4444' : '#22c55e' }]}>
                {(ctx.realTimeDailyDD || 0).toFixed(2)}% / {ctx.selectedChallengeAccount.challengeId?.rules?.maxDailyDrawdownPercent || ctx.selectedChallengeAccount.maxDailyDrawdownPercent || 5}%
              </Text>
            </View>
          </View>
          <View style={styles.challengeInfoRow}>
            <View style={styles.challengeInfoLeft}>
              <Text style={[styles.challengeInfoLabel, { color: colors.textMuted }]}>Overall DD: </Text>
              <Text style={[styles.challengeInfoValue, { color: (ctx.realTimeOverallDD || 0) > (ctx.selectedChallengeAccount.challengeId?.rules?.maxOverallDrawdownPercent || ctx.selectedChallengeAccount.maxOverallDrawdownPercent || 10) * 0.8 ? '#ef4444' : '#22c55e' }]}>
                {(ctx.realTimeOverallDD || 0).toFixed(2)}% / {ctx.selectedChallengeAccount.challengeId?.rules?.maxOverallDrawdownPercent || ctx.selectedChallengeAccount.maxOverallDrawdownPercent || 10}%
              </Text>
            </View>
            <View style={styles.challengeInfoRight}>
              <Text style={[styles.challengeInfoLabel, { color: colors.textMuted }]}>Profit: </Text>
              <Text style={[styles.challengeInfoValue, { color: (ctx.realTimeProfit || 0) >= 0 ? '#22c55e' : '#ef4444' }]}>
                {(ctx.realTimeProfit || 0).toFixed(2)}% / {ctx.selectedChallengeAccount.challengeId?.rules?.profitTargetPhase1Percent || 10}%
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Challenge Account Card - When in challenge mode */}
      {ctx.isChallengeMode && ctx.selectedChallengeAccount && (
        <View style={[styles.accountCard, { 
          backgroundColor: colors.bgCard, 
          borderColor: ctx.selectedChallengeAccount.status === 'FAILED' ? '#ef4444' : '#22c55e', 
          borderWidth: 2 
        }]}>
          <TouchableOpacity 
            style={styles.accountCardHeader}
            onPress={() => {
              ctx.setIsChallengeMode(false);
              ctx.setSelectedChallengeAccount(null);
              SecureStore.deleteItemAsync('selectedChallengeAccountId');
            }}
          >
            <View style={[styles.accountIconContainer, { 
              backgroundColor: ctx.selectedChallengeAccount.status === 'FAILED' ? '#ef444440' : '#22c55e40' 
            }]}>
              <Ionicons 
                name={ctx.selectedChallengeAccount.status === 'FAILED' ? 'close-circle-outline' : 'trophy-outline'} 
                size={20} 
                color={ctx.selectedChallengeAccount.status === 'FAILED' ? '#ef4444' : '#22c55e'} 
              />
            </View>
            <View style={styles.accountInfo}>
              <Text style={[styles.accountId, { color: colors.textPrimary }]}>{ctx.selectedChallengeAccount.accountId}</Text>
              <Text style={[styles.accountType, { color: colors.textSecondary }]}>{ctx.selectedChallengeAccount.challengeId?.name || 'Challenge'} • Step {ctx.selectedChallengeAccount.currentStep || 1}</Text>
            </View>
            <View style={[styles.challengeBadge, { 
              backgroundColor: ctx.selectedChallengeAccount.status === 'ACTIVE' ? '#22c55e20' : 
                              ctx.selectedChallengeAccount.status === 'PASSED' ? '#22c55e20' : '#ef444420' 
            }]}>
              <Text style={[styles.challengeBadgeText, { 
                color: ctx.selectedChallengeAccount.status === 'ACTIVE' ? '#22c55e' : 
                       ctx.selectedChallengeAccount.status === 'PASSED' ? '#22c55e' : '#ef4444' 
              }]}>
                {ctx.selectedChallengeAccount.status}
              </Text>
            </View>
          </TouchableOpacity>
          
          {/* Show FAILED reason if challenge failed */}
          {ctx.selectedChallengeAccount.status === 'FAILED' && (
            <View style={styles.failedReasonContainer}>
              <Ionicons name="warning-outline" size={18} color="#ef4444" />
              <Text style={styles.failedReasonText}>
                {ctx.selectedChallengeAccount.failReason || 'Challenge failed due to rule violation'}
              </Text>
            </View>
          )}
          
          {/* Challenge Balance & Equity Row */}
          <View style={[styles.balanceRow, { borderTopColor: colors.border }]}>
            <View>
              <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Balance</Text>
              <Text style={[styles.balanceValue, { color: colors.textPrimary }]}>${(ctx.selectedChallengeAccount.balance || ctx.selectedChallengeAccount.currentBalance || 0).toFixed(2)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Equity</Text>
              <Text style={[styles.equityValue, { color: ctx.totalFloatingPnl < 0 ? colors.error : colors.primary }]}>
                ${ctx.realTimeEquity.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Challenge Progress Row - Only show if not failed */}
          {ctx.selectedChallengeAccount.status !== 'FAILED' && (
            <View style={[styles.pnlRow, { borderTopColor: colors.border }]}>
              <View>
                <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Daily Drawdown</Text>
                <Text style={[styles.pnlValue, { color: (ctx.realTimeDailyDD || 0) > (ctx.selectedChallengeAccount.challengeId?.rules?.maxDailyDrawdownPercent || ctx.selectedChallengeAccount.maxDailyDrawdownPercent || 5) * 0.8 ? colors.error : colors.success }]}>
                  {(ctx.realTimeDailyDD || 0).toFixed(2)}%
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Profit Target</Text>
                <Text style={[styles.freeMarginValue, { color: colors.primary }]}>
                  {(ctx.realTimeProfit || 0).toFixed(2)}%
                </Text>
              </View>
            </View>
          )}

          {/* Action Buttons - Different for FAILED vs ACTIVE */}
          <View style={styles.cardActionButtons}>
            {ctx.selectedChallengeAccount.status === 'FAILED' ? (
              <>
                <TouchableOpacity 
                  style={[styles.depositBtn, { flex: 1, backgroundColor: '#22c55e' }]}
                  onPress={() => {
                    ctx.setIsChallengeMode(false);
                    ctx.setSelectedChallengeAccount(null);
                    SecureStore.deleteItemAsync('selectedChallengeAccountId');
                    navigation.navigate('Accounts', { activeTab: 'challenge' });
                  }}
                >
                  <Ionicons name="trophy-outline" size={16} color="#fff" />
                  <Text style={styles.depositBtnText}>Buy New Challenge</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.withdrawBtn, { flex: 1 }]}
                  onPress={() => {
                    ctx.setIsChallengeMode(false);
                    ctx.setSelectedChallengeAccount(null);
                    SecureStore.deleteItemAsync('selectedChallengeAccountId');
                  }}
                >
                  <Ionicons name="swap-horizontal-outline" size={16} color="#22c55e" />
                  <Text style={styles.withdrawBtnText}>Regular Account</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity 
                style={[styles.depositBtn, { flex: 1 }]}
                onPress={() => {
                  ctx.setIsChallengeMode(false);
                  ctx.setSelectedChallengeAccount(null);
                  SecureStore.deleteItemAsync('selectedChallengeAccountId');
                }}
              >
                <Ionicons name="swap-horizontal-outline" size={16} color="#fff" />
                <Text style={styles.depositBtnText}>Switch to Regular Account</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Regular Account Card - When not in challenge mode */}
      {!ctx.isChallengeMode && ctx.selectedAccount && (
        <View style={[styles.accountCard, { backgroundColor: colors.bgCard, borderColor: '#22c55e', borderWidth: 2 }]}>
          <TouchableOpacity style={styles.accountCardHeader} onPress={() => parentNav?.navigate('Accounts')}>
            <View style={[styles.accountIconContainer, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="person-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.accountInfo}>
              <Text style={[styles.accountId, { color: colors.textPrimary }]}>{ctx.selectedAccount.accountId}</Text>
              <Text style={[styles.accountType, { color: colors.textSecondary }]}>{ctx.selectedAccount.accountTypeId?.name || ctx.selectedAccount.accountType || 'Standard'} • {ctx.selectedAccount.leverage || '1:100'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          
          {/* Real-time Balance & Equity Row */}
          <View style={styles.balanceRow}>
            <View>
              <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Balance</Text>
              <Text style={[styles.balanceValue, { color: colors.textPrimary }]}>${(ctx.accountSummary?.balance || ctx.selectedAccount?.balance || 0).toFixed(2)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Equity</Text>
              <Text style={[styles.equityValue, { color: ctx.totalFloatingPnl >= 0 ? colors.success : colors.error }]}>
                ${ctx.realTimeEquity?.toFixed(2) || '0.00'}
              </Text>
            </View>
          </View>

          {/* Real-time P&L Row */}
          <View style={[styles.pnlRow, { borderTopColor: colors.border }]}>
            <View>
              <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Floating P&L</Text>
              <Text style={[styles.pnlValue, { color: ctx.totalFloatingPnl >= 0 ? colors.success : colors.error }]}>
                {ctx.totalFloatingPnl >= 0 ? '+' : ''}${ctx.totalFloatingPnl?.toFixed(2) || '0.00'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Free Margin</Text>
              <Text style={[styles.freeMarginValue, { color: colors.primary }]}>
                ${ctx.realTimeFreeMargin?.toFixed(2) || '0.00'}
              </Text>
            </View>
          </View>

          {/* Today's P&L Row */}
          <View style={[styles.pnlRow, { borderTopColor: colors.border }]}>
            <View>
              <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Today's P&L</Text>
              <Text style={[styles.pnlValue, { color: ctx.todayPnl >= 0 ? colors.success : colors.error }]}>
                {ctx.todayPnl >= 0 ? '+' : ''}${ctx.todayPnl?.toFixed(2) || '0.00'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Used Margin</Text>
              <Text style={[styles.freeMarginValue, { color: colors.textMuted }]}>
                ${(ctx.openTrades?.reduce((sum, t) => sum + (t.marginUsed || 0), 0) || 0).toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Deposit/Withdraw or Reset Buttons inside card */}
          <View style={styles.cardActionButtons}>
            {ctx.selectedAccount?.isDemo || ctx.selectedAccount?.accountTypeId?.isDemo ? (
              <TouchableOpacity 
                style={[styles.depositBtn, { backgroundColor: '#eab308', flex: 1 }]}
                onPress={() => {
                  Alert.alert(
                    'Reset Demo Account',
                    'Are you sure you want to reset this demo account? All open trades will be closed and balance will be reset.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Reset', style: 'destructive', onPress: async () => {
                        try {
                          const res = await fetch(`${API_URL}/trading-accounts/${ctx.selectedAccount._id}/reset-demo`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                          });
                          const data = await res.json();
                          if (data.success) {
                            Alert.alert('Success', data.message || 'Demo account reset successfully!');
                            ctx.refreshAccounts?.();
                          } else {
                            Alert.alert('Error', data.message || 'Failed to reset demo account');
                          }
                        } catch (error) {
                          Alert.alert('Error', 'Error resetting demo account');
                        }
                      }}
                    ]
                  );
                }}
              >
                <Ionicons name="refresh-outline" size={16} color="#000" />
                <Text style={[styles.depositBtnText, { color: '#000' }]}>Reset</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity 
                  style={[styles.depositBtn, { backgroundColor: colors.primary }]}
                  onPress={() => parentNav?.navigate('Accounts', { action: 'deposit', accountId: ctx.selectedAccount?._id })}
                >
                  <Ionicons name="arrow-down-circle-outline" size={16} color="#fff" />
                  <Text style={styles.depositBtnText}>Deposit</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.withdrawBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
                  onPress={() => parentNav?.navigate('Accounts', { action: 'withdraw', accountId: ctx.selectedAccount?._id })}
                >
                  <Ionicons name="arrow-up-circle-outline" size={16} color={colors.textPrimary} />
                  <Text style={[styles.withdrawBtnText, { color: colors.textPrimary }]}>Withdraw</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {/* Quick Actions - 8 Stylish Buttons */}
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity style={styles.quickActionBtn} onPress={() => parentNav?.navigate('Accounts')}>
          <Ionicons name="briefcase-outline" size={24} color={colors.primary} />
          <Text style={[styles.quickActionBtnLabel, { color: colors.textSecondary }]}>Accounts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('Markets')}>
          <Ionicons name="stats-chart-outline" size={24} color={colors.success} />
          <Text style={[styles.quickActionBtnLabel, { color: colors.textSecondary }]}>Markets</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('Trade')}>
          <Ionicons name="trending-up-outline" size={24} color={colors.info} />
          <Text style={[styles.quickActionBtnLabel, { color: colors.textSecondary }]}>Trade</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('Chart')}>
          <Ionicons name="analytics-outline" size={24} color={isDark ? '#a855f7' : '#7c3aed'} />
          <Text style={[styles.quickActionBtnLabel, { color: colors.textSecondary }]}>Chart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionBtn} onPress={() => parentNav?.navigate('Wallet')}>
          <Ionicons name="wallet-outline" size={24} color={colors.warning} />
          <Text style={[styles.quickActionBtnLabel, { color: colors.textSecondary }]}>Wallet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionBtn} onPress={() => parentNav?.navigate('CopyTrade')}>
          <Ionicons name="copy-outline" size={24} color={isDark ? '#ec4899' : '#db2777'} />
          <Text style={[styles.quickActionBtnLabel, { color: colors.textSecondary }]}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionBtn} onPress={() => parentNav?.navigate('IB')}>
          <Ionicons name="people-outline" size={24} color={isDark ? '#eab308' : '#ca8a04'} />
          <Text style={[styles.quickActionBtnLabel, { color: colors.textSecondary }]}>IB</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('More')}>
          <Ionicons name="grid-outline" size={24} color={isDark ? '#84cc16' : '#65a30d'} />
          <Text style={[styles.quickActionBtnLabel, { color: colors.textSecondary }]}>More</Text>
        </TouchableOpacity>
      </View>

      {/* Copy Trade Masters - Horizontal Scrolling Cards */}
      {masters.length > 0 && (
        <View style={styles.mastersSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="trophy-outline" size={18} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Top Masters</Text>
            </View>
            <TouchableOpacity onPress={() => parentNav?.navigate('CopyTrade')}>
              <Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mastersScroll}>
            {masters.slice(0, 10).map((master) => {
              const following = isFollowingMaster(master._id);
              return (
                <TouchableOpacity 
                  key={master._id} 
                  style={[styles.masterCard, { backgroundColor: colors.bgCard }]}
                  onPress={() => { setSelectedMaster(master); setShowMasterModal(true); }}
                >
                  <View style={styles.masterCardHeader}>
                    <View style={[styles.masterAvatar, { backgroundColor: colors.primary + '30' }]}>
                      <Text style={[styles.masterAvatarText, { color: colors.primary }]}>
                        {master.userId?.firstName?.charAt(0) || 'M'}
                      </Text>
                    </View>
                    {following && (
                      <View style={styles.followingBadgeSmall}>
                        <Ionicons name="checkmark" size={10} color={colors.success} />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.masterName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {master.userId?.firstName || 'Master'}
                  </Text>
                  <Text style={[styles.masterProfit, { color: colors.success }]}>
                    +{(master.stats?.totalProfitGenerated || 0).toFixed(0)}%
                  </Text>
                  <Text style={[styles.masterFollowers, { color: colors.textMuted }]}>
                    {master.stats?.totalFollowers || 0} followers
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Watchlist / Gainers / Losers Section */}
      <View style={styles.marketDataSection}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="trending-up-outline" size={18} color={colors.accent} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Markets</Text>
          </View>
        </View>
        
        {/* Market Tabs */}
        <View style={[styles.marketTabs, { backgroundColor: colors.bgCard }]}>
          <TouchableOpacity 
            style={[styles.marketTab, marketTab === 'watchlist' && [styles.marketTabActive, { backgroundColor: colors.accent }]]}
            onPress={() => setMarketTab('watchlist')}
          >
            <Text style={[styles.marketTabText, { color: colors.textSecondary }, marketTab === 'watchlist' && styles.marketTabTextActive]}>Watchlist</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.marketTab, marketTab === 'gainers' && [styles.marketTabActive, { backgroundColor: colors.accent }]]}
            onPress={() => setMarketTab('gainers')}
          >
            <Ionicons name="arrow-up" size={14} color={marketTab === 'gainers' ? '#fff' : colors.success} />
            <Text style={[styles.marketTabText, { color: colors.textSecondary }, marketTab === 'gainers' && styles.marketTabTextActive]}>Gainers</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.marketTab, marketTab === 'losers' && [styles.marketTabActive, { backgroundColor: colors.accent }]]}
            onPress={() => setMarketTab('losers')}
          >
            <Ionicons name="arrow-down" size={14} color={marketTab === 'losers' ? '#fff' : colors.error} />
            <Text style={[styles.marketTabText, { color: colors.textSecondary }, marketTab === 'losers' && styles.marketTabTextActive]}>Losers</Text>
          </TouchableOpacity>
        </View>

        {/* Market Data List */}
        <View style={styles.marketList}>
          {getMarketData().length === 0 && marketTab === 'watchlist' ? (
            <View style={styles.emptyWatchlistHome}>
              <Ionicons name="star-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyWatchlistHomeText, { color: colors.textSecondary }]}>No instruments in watchlist</Text>
              <Text style={[styles.emptyWatchlistHomeHint, { color: colors.textMuted }]}>Go to Markets and tap ★ to add instruments</Text>
            </View>
          ) : getMarketData().length === 0 ? (
            <View style={styles.emptyWatchlistHome}>
              <Ionicons name={marketTab === 'gainers' ? 'trending-up' : 'trending-down'} size={32} color={colors.textMuted} />
              <Text style={[styles.emptyWatchlistHomeText, { color: colors.textSecondary }]}>No {marketTab} at the moment</Text>
              <Text style={[styles.emptyWatchlistHomeHint, { color: colors.textMuted }]}>Market data will update in real-time</Text>
            </View>
          ) : (
            getMarketData().map((inst) => {
              const isPositive = inst.change >= 0;
              const price = ctx.livePrices[inst.symbol];
              const decimals = inst.category === 'Forex' ? 5 : 2;
              return (
                <TouchableOpacity 
                  key={inst.symbol} 
                  style={[styles.marketItem, { borderBottomColor: colors.border }]}
                  onPress={() => navigation.navigate('Chart')}
                >
                  <View style={styles.marketItemLeft}>
                    <Text style={[styles.marketSymbol, { color: colors.textPrimary }]}>{inst.symbol}</Text>
                    <Text style={[styles.marketName, { color: colors.textMuted }]} numberOfLines={1}>{inst.name}</Text>
                  </View>
                  <View style={styles.marketItemRight}>
                    <Text style={[styles.marketPrice, { color: colors.textPrimary }]}>{(price?.ask || 0).toFixed(decimals)}</Text>
                    <View style={[styles.changeBadge, { backgroundColor: isPositive ? colors.success + '20' : colors.error + '20' }]}>
                      <Ionicons name={isPositive ? 'arrow-up' : 'arrow-down'} size={10} color={isPositive ? colors.success : colors.error} />
                      <Text style={[styles.changeText, { color: isPositive ? colors.success : colors.error }]}>
                        {Math.abs(inst.change).toFixed(2)}%
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </View>

      {/* Master Detail Modal */}
      <Modal visible={showMasterModal} animationType="slide" transparent onRequestClose={() => setShowMasterModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.masterDetailModal, { backgroundColor: colors.bgCard }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <View style={styles.masterModalHeader}>
              <Text style={[styles.masterModalTitle, { color: colors.textPrimary }]}>Master Profile</Text>
              <TouchableOpacity onPress={() => setShowMasterModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedMaster && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Master Info */}
                <View style={styles.masterProfileCard}>
                  <View style={[styles.masterProfileAvatar, { backgroundColor: colors.primary + '30' }]}>
                    <Text style={[styles.masterProfileAvatarText, { color: colors.primary }]}>
                      {selectedMaster.userId?.firstName?.charAt(0) || 'M'}
                    </Text>
                  </View>
                  <Text style={[styles.masterProfileName, { color: colors.textPrimary }]}>
                    {selectedMaster.userId?.firstName || 'Master Trader'}
                  </Text>
                  <Text style={[styles.masterProfileBio, { color: colors.textSecondary }]}>
                    {selectedMaster.bio || 'Professional trader with consistent returns'}
                  </Text>
                  {isFollowingMaster(selectedMaster._id) && (
                    <View style={styles.followingBadgeLarge}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                      <Text style={[styles.followingBadgeLargeText, { color: colors.success }]}>Following</Text>
                    </View>
                  )}
                </View>

                {/* Stats Grid */}
                <View style={styles.masterStatsGrid}>
                  <View style={[styles.masterStatBox, { backgroundColor: colors.bgSecondary }]}>
                    <Text style={[styles.masterStatLabel, { color: colors.textMuted }]}>Total Profit</Text>
                    <Text style={[styles.masterStatValue, { color: colors.success }]}>
                      ${(selectedMaster.stats?.totalProfitGenerated || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={[styles.masterStatBox, { backgroundColor: colors.bgSecondary }]}>
                    <Text style={[styles.masterStatLabel, { color: colors.textMuted }]}>Win Rate</Text>
                    <Text style={[styles.masterStatValue, { color: colors.textPrimary }]}>
                      {(selectedMaster.stats?.winRate || 0).toFixed(1)}%
                    </Text>
                  </View>
                  <View style={[styles.masterStatBox, { backgroundColor: colors.bgSecondary }]}>
                    <Text style={[styles.masterStatLabel, { color: colors.textMuted }]}>Followers</Text>
                    <Text style={[styles.masterStatValue, { color: colors.textPrimary }]}>
                      {selectedMaster.stats?.totalFollowers || 0}
                    </Text>
                  </View>
                  <View style={[styles.masterStatBox, { backgroundColor: colors.bgSecondary }]}>
                    <Text style={[styles.masterStatLabel, { color: colors.textMuted }]}>Commission</Text>
                    <Text style={[styles.masterStatValue, { color: colors.textPrimary }]}>
                      {selectedMaster.approvedCommissionPercentage || 0}%
                    </Text>
                  </View>
                </View>

                {/* Follow Button */}
                {!isFollowingMaster(selectedMaster._id) ? (
                  <TouchableOpacity 
                    style={[styles.followMasterBtn, { backgroundColor: colors.primary }, isFollowing && styles.btnDisabled]}
                    onPress={() => handleFollowMaster(selectedMaster)}
                    disabled={isFollowing}
                  >
                    {isFollowing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="add-circle-outline" size={18} color="#fff" />
                        <Text style={styles.followMasterBtnText}>Follow Master</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.alreadyFollowingBox}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={[styles.alreadyFollowingText, { color: colors.success }]}>You are following this master</Text>
                  </View>
                )}

                {/* View Full Profile */}
                <TouchableOpacity 
                  style={styles.viewFullProfileBtn}
                  onPress={() => { setShowMasterModal(false); parentNav?.navigate('CopyTrade'); }}
                >
                  <Text style={[styles.viewFullProfileText, { color: colors.primary }]}>View Full Profile</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MarketWatch News */}
      <View style={styles.marketWatchSection}>
        <View style={styles.marketWatchHeader}>
          <View style={styles.marketWatchTitleRow}>
            <Ionicons name="newspaper-outline" size={20} color={colors.primary} />
            <Text style={[styles.marketWatchTitle, { color: colors.textPrimary }]}>MarketWatch News</Text>
          </View>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
        
        {/* News Cards - Vertical */}
        <View style={styles.newsCardsVertical}>
          {[
            {
              id: 1,
              category: 'Markets',
              title: 'Fed signals potential rate cuts amid cooling inflation data',
              description: 'Federal Reserve officials hint at possible monetary policy easing as inflation shows signs of moderating...',
              time: '5m ago',
              image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400',
            },
            {
              id: 2,
              category: 'Crypto',
              title: 'Bitcoin surges past key resistance as institutional buying accelerates',
              description: 'Major cryptocurrency rallies as large investors increase positions ahead of halving event...',
              time: '12m ago',
              image: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400',
            },
            {
              id: 3,
              category: 'Forex',
              title: 'EUR/USD volatility spikes on ECB policy divergence',
              description: 'Euro faces pressure as European Central Bank maintains hawkish stance while Fed pivots...',
              time: '28m ago',
              image: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400',
            },
            {
              id: 4,
              category: 'Commodities',
              title: 'Gold hits new highs as safe-haven demand increases',
              description: 'Precious metal reaches record levels amid geopolitical tensions and dollar weakness...',
              time: '45m ago',
              image: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=400',
            },
            {
              id: 5,
              category: 'Markets',
              title: 'Tech stocks lead market rally on strong earnings',
              description: 'Major indices climb as technology sector reports better-than-expected quarterly results...',
              time: '1h ago',
              image: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=400',
            },
          ].map((news) => (
            <TouchableOpacity 
              key={news.id}
              style={[styles.newsCardFull, { backgroundColor: colors.bgCard }]}
              onPress={() => Linking.openURL('https://www.marketwatch.com/latest-news')}
              activeOpacity={0.8}
            >
              <Image 
                source={{ uri: news.image }}
                style={styles.newsCardImageFull}
                resizeMode="cover"
              />
              <View style={styles.newsCardContentFull}>
                <View style={styles.newsCardMeta}>
                  <View style={styles.newsCategoryBadge}>
                    <Text style={styles.newsCategoryText}>{news.category}</Text>
                  </View>
                  <Text style={[styles.newsTime, { color: colors.textMuted }]}>{news.time}</Text>
                </View>
                <Text style={[styles.newsCardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                  {news.title}
                </Text>
                <Text style={[styles.newsCardDesc, { color: colors.textMuted }]} numberOfLines={3}>
                  {news.description}
                </Text>
                <View style={styles.newsCardFooter}>
                  <Ionicons name="globe-outline" size={14} color={colors.textMuted} />
                  <Text style={[styles.newsSource, { color: colors.textMuted }]}>MarketWatch</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

// QUOTES TAB - Full Order Panel with all order types
const QuotesTab = ({ navigation }) => {
  const ctx = React.useContext(TradingContext);
  const { colors } = useTheme();
  const toast = useToast();
  const orderScrollRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('watchlist');
  const [expandedSegment, setExpandedSegment] = useState(null);
  const [selectedInstrument, setSelectedInstrument] = useState(null);
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [orderSide, setOrderSide] = useState('BUY');
  const [orderType, setOrderType] = useState('MARKET');
  const [pendingType, setPendingType] = useState('LIMIT');
  const [volume, setVolume] = useState(0.01);
  const [volumeText, setVolumeText] = useState('0.01');
  const [pendingPrice, setPendingPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showQuickSlModal, setShowQuickSlModal] = useState(false);
  const [quickSlValue, setQuickSlValue] = useState('');
  const [pendingQuickTradeSide, setPendingQuickTradeSide] = useState(null);
  
  // Get leverage from account
  const getAccountLeverage = () => {
    if (ctx.isChallengeMode && ctx.selectedChallengeAccount) {
      return ctx.selectedChallengeAccount.leverage || '1:100';
    }
    return ctx.selectedAccount?.leverage || ctx.selectedAccount?.accountTypeId?.leverage || '1:100';
  };
  
  const segments = ['Forex', 'Metals', 'Commodities', 'Crypto'];

  const openTradePanel = (instrument) => {
    setSelectedInstrument(instrument);
    setShowOrderPanel(true);
  };

  // Helper to get segment/category from symbol
  const getSymbolCategory = (symbol) => {
    if (['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD'].includes(symbol)) return 'Metals';
    if (['USOIL', 'UKOIL', 'NGAS', 'COPPER', 'ALUMINUM', 'NICKEL'].includes(symbol)) return 'Commodities';
    const cryptoSymbols = ['BTCUSD', 'ETHUSD', 'BNBUSD', 'SOLUSD', 'XRPUSD', 'ADAUSD', 'DOGEUSD', 'TRXUSD', 'LINKUSD', 'MATICUSD', 'DOTUSD', 'SHIBUSD', 'LTCUSD', 'BCHUSD', 'AVAXUSD', 'XLMUSD', 'UNIUSD', 'ATOMUSD', 'ETCUSD', 'FILUSD', 'ICPUSD', 'VETUSD', 'NEARUSD', 'GRTUSD', 'AAVEUSD', 'MKRUSD', 'ALGOUSD', 'FTMUSD', 'SANDUSD', 'MANAUSD', 'AXSUSD', 'THETAUSD', 'XMRUSD', 'FLOWUSD', 'SNXUSD', 'EOSUSD', 'CHZUSD', 'ENJUSD', 'ZILUSD', 'BATUSD', 'CRVUSD', 'COMPUSD', 'SUSHIUSD', 'ZRXUSD', 'LRCUSD', 'ANKRUSD', 'GALAUSD', 'APEUSD', 'WAVESUSD', 'ZECUSD', 'PEPEUSD', 'ARBUSD', 'OPUSD', 'SUIUSD', 'APTUSD', 'INJUSD', 'LDOUSD', 'IMXUSD', 'RUNEUSD', 'KAVAUSD', 'KSMUSD', 'NEOUSD', 'QNTUSD', 'FETUSD', 'RNDRUSD', 'OCEANUSD', 'WLDUSD', 'SEIUSD', 'TIAUSD', 'BLURUSD', 'TONUSD', 'HBARUSD', '1INCHUSD', 'BONKUSD', 'FLOKIUSD', 'ORDIUSD'];
    if (cryptoSymbols.includes(symbol)) return 'Crypto';
    return 'Forex';
  };

  const executeTrade = async (overrideStopLoss = null, overrideSide = null) => {
    // Check if we have a valid account (either regular or challenge)
    const hasValidAccount = ctx.isChallengeMode 
      ? ctx.selectedChallengeAccount 
      : ctx.selectedAccount;
    
    if (!selectedInstrument || !hasValidAccount || !ctx.user) return;
    if (isExecuting) return;
    
    // Use override values if provided, otherwise use state
    const effectiveStopLoss = overrideStopLoss || stopLoss;
    const effectiveSide = overrideSide || orderSide;
    
    // Client-side validation for challenge account SL mandatory rule
    if (ctx.isChallengeMode && ctx.selectedChallengeAccount) {
      const rules = ctx.selectedChallengeAccount.challengeId?.rules;
      if (rules?.stopLossMandatory && !effectiveStopLoss) {
        toast?.showToast('⚠️ Stop Loss is mandatory for this challenge', 'warning');
        return;
      }
    }
    
    const activeAccount = ctx.isChallengeMode ? ctx.selectedChallengeAccount : ctx.selectedAccount;
    console.log('DEBUG: Executing trade with account:', { 
      accountId: activeAccount?.accountId, 
      _id: activeAccount?._id,
      balance: activeAccount?.balance, 
      isChallengeMode: ctx.isChallengeMode
    });
    
    setIsExecuting(true);
    try {
      const prices = ctx.livePrices[selectedInstrument.symbol];
      const bid = prices?.bid;
      const ask = prices?.ask;
      
      // Validate prices
      if (!bid || !ask || bid <= 0 || ask <= 0) {
        toast?.showToast('Market is closed or no price data available', 'error');
        setIsExecuting(false);
        return;
      }

      // Validate pending price for pending orders
      if (orderType === 'PENDING' && !pendingPrice) {
        toast?.showToast('Please enter a pending price', 'warning');
        setIsExecuting(false);
        return;
      }

      const segment = getSymbolCategory(selectedInstrument.symbol);
      
      // For pending orders, use entry price for bid/ask (matching web version)
      const finalBid = (orderType === 'PENDING' && pendingPrice) ? parseFloat(pendingPrice) : parseFloat(bid);
      const finalAsk = (orderType === 'PENDING' && pendingPrice) ? parseFloat(pendingPrice) : parseFloat(ask);
      
      // Build order data matching web format
      // Pending order types: BUY_LIMIT, BUY_STOP, SELL_LIMIT, SELL_STOP
      // Use challenge account ID if in challenge mode, otherwise use regular account
      const tradingAccountId = ctx.isChallengeMode && ctx.selectedChallengeAccount 
        ? ctx.selectedChallengeAccount._id 
        : ctx.selectedAccount._id;
      const orderData = {
        userId: ctx.user._id,
        tradingAccountId: tradingAccountId,
        symbol: selectedInstrument.symbol,
        segment: segment,
        side: effectiveSide,
        orderType: orderType === 'MARKET' ? 'MARKET' : `${effectiveSide}_${pendingType}`,
        quantity: parseFloat(volume) || 0.01,
        bid: finalBid,
        ask: finalAsk,
        leverage: getAccountLeverage(),
      };
      
      // Add SL/TP if set (use effectiveStopLoss which includes override from quick trade modal)
      if (effectiveStopLoss) orderData.sl = parseFloat(effectiveStopLoss);
      if (takeProfit) orderData.tp = parseFloat(takeProfit);

      console.log('Trade order data:', JSON.stringify(orderData, null, 2));
      
      const res = await fetch(`${API_URL}/trade/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      const data = await res.json();
      console.log('Trade response:', res.status, JSON.stringify(data, null, 2));
      
      if (data.success) {
        const isChallengeTradeMsg = data.isChallengeAccount ? ' (Challenge)' : '';
        toast?.showToast(`${effectiveSide} ${orderType === 'MARKET' ? 'Market' : pendingType} order placed!${isChallengeTradeMsg}`, 'success');
        setShowOrderPanel(false);
        setPendingPrice('');
        setStopLoss('');
        setTakeProfit('');
        ctx.fetchOpenTrades();
        ctx.fetchPendingOrders();
        ctx.fetchAccountSummary();
      } else {
        console.error('Trade failed:', data.message);
        // Handle challenge-specific error codes
        if (data.code === 'DRAWDOWN_BREACH' || data.code === 'DAILY_DRAWDOWN_BREACH') {
          toast?.showToast(`⚠️ Challenge Failed: ${data.message}`, 'error');
        } else if (data.code === 'MAX_LOTS_EXCEEDED' || data.code === 'MIN_LOTS_REQUIRED') {
          toast?.showToast(`⚠️ Lot Size Error: ${data.message}`, 'warning');
        } else if (data.accountFailed) {
          toast?.showToast(`❌ Challenge Account Failed: ${data.failReason || data.message}`, 'error');
        } else {
          toast?.showToast(data.message || 'Failed to place order', 'error');
        }
      }
    } catch (e) {
      console.error('Trade execution error:', e);
      toast?.showToast('Network error: ' + e.message, 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  const toggleStar = (symbol) => {
    ctx.setInstruments(prev => prev.map(i => 
      i.symbol === symbol ? { ...i, starred: !i.starred } : i
    ));
  };

  const watchlistInstruments = ctx.instruments.filter(inst => {
    const matchesSearch = inst.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.name.toLowerCase().includes(searchTerm.toLowerCase());
    return inst.starred && matchesSearch;
  });

  const getSegmentInstruments = (segment) => {
    return ctx.instruments.filter(inst => {
      const matchesSearch = inst.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inst.name.toLowerCase().includes(searchTerm.toLowerCase());
      // Map 'Energy' from backend to 'Commodities' segment in app
      const instCategory = inst.category === 'Energy' ? 'Commodities' : inst.category;
      return instCategory === segment && matchesSearch;
    });
  };

  const renderInstrumentItem = (item) => {
    const prices = ctx.livePrices[item.symbol] || {};
    return (
      <TouchableOpacity 
        key={item.symbol}
        style={[styles.instrumentItem, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}
        onPress={() => openTradePanel(item)}
        activeOpacity={0.7}
      >
        <TouchableOpacity 
          style={styles.starBtn}
          onPress={() => toggleStar(item.symbol)}
        >
          <Ionicons 
            name={item.starred ? "star" : "star-outline"} 
            size={18} 
            color={item.starred ? colors.accent : colors.textMuted} 
          />
        </TouchableOpacity>
        <View style={styles.instrumentInfo}>
          <Text style={[styles.instrumentSymbol, { color: colors.textPrimary }]}>{item.symbol}</Text>
          <Text style={[styles.instrumentName, { color: colors.textMuted }]}>{item.name}</Text>
        </View>
        <View style={styles.instrumentPriceCol}>
          <Text style={styles.bidPrice}>{prices.bid?.toFixed(prices.bid > 100 ? 2 : 5) || '...'}</Text>
          <Text style={[styles.priceLabel, { color: colors.textMuted }]}>Bid</Text>
        </View>
        <View style={[styles.spreadBadgeCol, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <Text style={[styles.spreadBadgeText, { color: colors.accent }]}>
            {ctx.adminSpreads[item.symbol]?.spread > 0 
              ? (item.symbol.includes('JPY') 
                  ? (ctx.adminSpreads[item.symbol].spread * 100).toFixed(1)
                  : prices.bid > 100 
                    ? ctx.adminSpreads[item.symbol].spread.toFixed(2)
                    : (ctx.adminSpreads[item.symbol].spread * 10000).toFixed(1))
              : (prices.bid && prices.ask ? ((prices.ask - prices.bid) * (prices.bid > 100 ? 1 : 10000)).toFixed(1) : '-')}
          </Text>
        </View>
        <View style={styles.instrumentPriceCol}>
          <Text style={styles.askPrice}>{prices.ask?.toFixed(prices.ask > 100 ? 2 : 5) || '...'}</Text>
          <Text style={[styles.priceLabel, { color: colors.textMuted }]}>Ask</Text>
        </View>
        <TouchableOpacity 
          style={[styles.chartIconBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
          onPress={() => navigation.navigate('Chart', { symbol: item.symbol })}
        >
          <Ionicons name="trending-up" size={18} color={colors.accent} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Brand Bar */}
      <View style={styles.brandBar}>
        <HeaderLogo size={32} />
        <Text style={[styles.brandBarText, { color: colors.textPrimary }]}>ProlineMarkets</Text>
      </View>
      {/* Search Bar */}
      <View style={[styles.marketSearchContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search instruments..."
          placeholderTextColor={colors.textMuted}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Account Selector - Below search bar */}
      <TouchableOpacity style={[styles.accountSelector, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={() => setShowAccountPicker(true)}>
        <View style={styles.accountSelectorLeft}>
          <View style={styles.accountIcon}>
            <Ionicons name="wallet" size={16} color={colors.accent} />
          </View>
          <View>
            <Text style={[styles.accountSelectorLabel, { color: colors.textMuted }]}>Account</Text>
            <Text style={[styles.accountSelectorValue, { color: colors.textPrimary }]}>
              {ctx.isChallengeMode 
                ? `${ctx.selectedChallengeAccount?.accountId || 'Select'} • $${(ctx.selectedChallengeAccount?.currentBalance || 0).toFixed(2)}`
                : `${ctx.selectedAccount?.accountId || ctx.selectedAccount?.accountNumber || 'Select'} • $${(ctx.selectedAccount?.balance || ctx.accountSummary?.balance || 0).toFixed(2)}`
              }
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Watchlist / Markets Toggle */}
      <View style={[styles.marketTabsContainer, { backgroundColor: colors.bgSecondary }]}>
        <TouchableOpacity
          style={[styles.marketTabBtn, activeTab === 'watchlist' && { backgroundColor: colors.accent }]}
          onPress={() => setActiveTab('watchlist')}
        >
          <Text style={[styles.marketTabText, { color: colors.textMuted }, activeTab === 'watchlist' && styles.marketTabTextActive]}>
            Watchlist
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.marketTabBtn, activeTab === 'markets' && { backgroundColor: colors.accent }]}
          onPress={() => setActiveTab('markets')}
        >
          <Text style={[styles.marketTabText, { color: colors.textMuted }, activeTab === 'markets' && styles.marketTabTextActive]}>
            Markets
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.marketContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'watchlist' ? (
          <>
            {watchlistInstruments.length === 0 ? (
              <View style={styles.emptyWatchlist}>
                <Ionicons name="star-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyWatchlistTitle, { color: colors.textPrimary }]}>No instruments in watchlist</Text>
                <Text style={[styles.emptyWatchlistText, { color: colors.textMuted }]}>
                  Tap the star icon on any instrument to add it to your watchlist
                </Text>
              </View>
            ) : (
              watchlistInstruments.map(item => renderInstrumentItem(item))
            )}
          </>
        ) : (
          <>
            {segments.map(segment => {
              const segmentInstruments = getSegmentInstruments(segment);
              const isExpanded = expandedSegment === segment;
              return (
                <View key={segment} style={[styles.segmentContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <TouchableOpacity 
                    style={[styles.segmentHeader, { backgroundColor: colors.bgCard }]}
                    onPress={() => setExpandedSegment(isExpanded ? null : segment)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.segmentHeaderLeft}>
                      <Ionicons 
                        name={segment === 'Forex' ? 'swap-horizontal' : segment === 'Metals' ? 'diamond' : segment === 'Commodities' ? 'flame' : 'logo-bitcoin'} 
                        size={20} 
                        color={colors.accent} 
                      />
                      <Text style={[styles.segmentTitle, { color: colors.textPrimary }]}>{segment}</Text>
                      <View style={[styles.segmentCount, { backgroundColor: colors.bgSecondary }]}>
                        <Text style={[styles.segmentCountText, { color: colors.textMuted }]}>{segmentInstruments.length}</Text>
                      </View>
                    </View>
                    <Ionicons 
                      name={isExpanded ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color={colors.textMuted} 
                    />
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={[styles.segmentInstruments, { borderTopColor: colors.border }]}>
                      {segmentInstruments.map(item => renderInstrumentItem(item))}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Order Panel Slide Up - Full Order Types */}
      <Modal visible={showOrderPanel} animationType="slide" transparent>
        <KeyboardAvoidingView 
          style={styles.orderModalOverlay} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <TouchableOpacity 
            style={styles.orderPanelBackdrop} 
            activeOpacity={1} 
            onPress={() => setShowOrderPanel(false)}
          />
          <ScrollView 
            ref={orderScrollRef}
            style={[styles.orderPanelScroll, { backgroundColor: colors.bgCard }]} 
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.orderPanelContainer, { backgroundColor: colors.bgCard }]}>
              {/* Handle Bar */}
              <View style={[styles.orderPanelHandle, { backgroundColor: colors.border }]} />
              
              {/* Header */}
              <View style={styles.orderPanelHeaderRow}>
                <View>
                  <Text style={[styles.orderPanelSymbol, { color: colors.textPrimary }]}>{selectedInstrument?.symbol}</Text>
                  <Text style={[styles.orderPanelName, { color: colors.textMuted }]}>{selectedInstrument?.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowOrderPanel(false)} style={styles.orderCloseBtn}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Leverage Display (from account) */}
              <View style={[styles.leverageRow, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                <Text style={[styles.leverageLabel, { color: colors.textMuted }]}>Leverage</Text>
                <Text style={[styles.leverageValue, { color: colors.textPrimary }]}>{getAccountLeverage()}</Text>
              </View>

              {/* One-Click Buy/Sell - Slim Buttons */}
              <View style={styles.quickTradeRow}>
                <TouchableOpacity 
                  style={[styles.quickSellBtn, isExecuting && styles.btnDisabled]}
                  onPress={() => { 
                    // Check if challenge mode with SL mandatory
                    if (ctx.isChallengeMode && ctx.selectedChallengeAccount?.challengeId?.rules?.stopLossMandatory) {
                      setPendingQuickTradeSide('SELL');
                      setQuickSlValue('');
                      setShowQuickSlModal(true);
                    } else {
                      setOrderSide('SELL'); 
                      setOrderType('MARKET'); 
                      executeTrade(); 
                    }
                  }}
                  disabled={isExecuting}
                >
                  <Text style={styles.quickBtnLabel}>SELL</Text>
                  <Text style={styles.quickBtnPrice}>
                    {ctx.livePrices[selectedInstrument?.symbol]?.bid?.toFixed(selectedInstrument?.category === 'Forex' ? 5 : 2) || '-'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.quickBuyBtn, isExecuting && styles.btnDisabled]}
                  onPress={() => { 
                    // Check if challenge mode with SL mandatory
                    if (ctx.isChallengeMode && ctx.selectedChallengeAccount?.challengeId?.rules?.stopLossMandatory) {
                      setPendingQuickTradeSide('BUY');
                      setQuickSlValue('');
                      setShowQuickSlModal(true);
                    } else {
                      setOrderSide('BUY'); 
                      setOrderType('MARKET'); 
                      executeTrade(); 
                    }
                  }}
                  disabled={isExecuting}
                >
                  <Text style={styles.quickBtnLabel}>BUY</Text>
                  <Text style={styles.quickBtnPrice}>
                    {ctx.livePrices[selectedInstrument?.symbol]?.ask?.toFixed(selectedInstrument?.category === 'Forex' ? 5 : 2) || '-'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Spread Info */}
              <View style={styles.spreadInfoRow}>
                <Text style={[styles.spreadInfoText, { color: colors.textMuted }]}>
                  Spread: {ctx.livePrices[selectedInstrument?.symbol]?.bid ? 
                    ((ctx.livePrices[selectedInstrument?.symbol]?.ask - ctx.livePrices[selectedInstrument?.symbol]?.bid) * 
                    (selectedInstrument?.category === 'Forex' ? 10000 : 1)).toFixed(1) : '-'} pips
                </Text>
              </View>

              {/* SL Mandatory Warning for Challenge Accounts */}
              {ctx.isChallengeMode && ctx.selectedChallengeAccount?.challengeId?.rules?.stopLossMandatory && (
                <View style={styles.slMandatoryBanner}>
                  <Ionicons name="warning" size={16} color="#f59e0b" />
                  <Text style={styles.slMandatoryText}>Stop Loss is mandatory for this challenge account</Text>
                </View>
              )}

              {/* Order Type Toggle */}
              <View style={styles.orderTypeRow}>
                <TouchableOpacity 
                  style={[styles.orderTypeBtn, { backgroundColor: colors.bgSecondary }, orderType === 'MARKET' && styles.orderTypeBtnActive]}
                  onPress={() => setOrderType('MARKET')}
                >
                  <Text style={[styles.orderTypeBtnText, { color: colors.textMuted }, orderType === 'MARKET' && styles.orderTypeBtnTextActive]}>Market</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.orderTypeBtn, { backgroundColor: colors.bgSecondary }, orderType === 'PENDING' && styles.orderTypeBtnActive]}
                  onPress={() => setOrderType('PENDING')}
                >
                  <Text style={[styles.orderTypeBtnText, { color: colors.textMuted }, orderType === 'PENDING' && styles.orderTypeBtnTextActive]}>Pending</Text>
                </TouchableOpacity>
              </View>

              {/* Pending Order Types */}
              {orderType === 'PENDING' && (
                <View style={styles.pendingTypeRow}>
                  {['LIMIT', 'STOP'].map(type => (
                    <TouchableOpacity 
                      key={type}
                      style={[styles.pendingTypeBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }, pendingType === type && styles.pendingTypeBtnActive]}
                      onPress={() => setPendingType(type)}
                    >
                      <Text style={[styles.pendingTypeText, { color: colors.textMuted }, pendingType === type && styles.pendingTypeTextActive]}>
                        {type === 'LIMIT' ? 'Limit' : 'Stop'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Pending Price Input */}
              {orderType === 'PENDING' && (
                <View style={styles.inputSection}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                    {pendingType === 'LIMIT' ? 'Limit Price' : 'Stop Price'}
                  </Text>
                  <TextInput
                    style={[styles.priceInput, { backgroundColor: colors.bgSecondary, color: colors.textPrimary, borderColor: colors.border }]}
                    value={pendingPrice}
                    onChangeText={setPendingPrice}
                    placeholder={ctx.livePrices[selectedInstrument?.symbol]?.bid?.toFixed(2) || '0.00'}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}

              {/* Volume Control */}
              <View style={styles.inputSection}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Volume (Lots)</Text>
                <View style={styles.volumeControlRow}>
                  <TouchableOpacity 
                    style={[styles.volumeControlBtn, { backgroundColor: colors.accent }]} 
                    onPress={() => {
                      const newVol = Math.max(0.01, volume - 0.01);
                      setVolume(newVol);
                      setVolumeText(newVol.toFixed(2));
                    }}
                  >
                    <Ionicons name="remove" size={18} color="#fff" />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.volumeInputField, { backgroundColor: colors.bgSecondary, color: colors.textPrimary, borderColor: colors.border }]}
                    value={volumeText}
                    onChangeText={(text) => {
                      // Allow empty, numbers, and decimal point
                      if (text === '' || /^\d*\.?\d*$/.test(text)) {
                        setVolumeText(text);
                        // Update volume state in real-time for valid numbers
                        const val = parseFloat(text);
                        if (!isNaN(val) && val > 0) {
                          setVolume(val);
                        }
                      }
                    }}
                    onFocus={() => {
                      // Scroll to make input visible above keyboard
                      setTimeout(() => {
                        orderScrollRef.current?.scrollTo({ y: 200, animated: true });
                      }, 300);
                    }}
                    onBlur={() => {
                      const val = parseFloat(volumeText);
                      if (isNaN(val) || val <= 0) {
                        setVolumeText('0.01');
                        setVolume(0.01);
                      } else {
                        setVolume(val);
                        setVolumeText(val.toFixed(2));
                      }
                    }}
                    keyboardType="decimal-pad"
                    selectTextOnFocus={true}
                  />
                  <TouchableOpacity 
                    style={[styles.volumeControlBtn, { backgroundColor: colors.accent }]} 
                    onPress={() => {
                      const newVol = volume + 0.01;
                      setVolume(newVol);
                      setVolumeText(newVol.toFixed(2));
                    }}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Stop Loss & Take Profit */}
              <View style={styles.slTpRow}>
                <View style={styles.slTpCol}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Stop Loss</Text>
                  <TextInput
                    style={[styles.slTpInputOrder, { backgroundColor: colors.bgSecondary, color: colors.textPrimary, borderColor: colors.border }]}
                    value={stopLoss}
                    onChangeText={(text) => setStopLoss(text.replace(/[^0-9.]/g, ''))}
                    placeholder="Optional"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numbers-and-punctuation"
                    selectionColor="#22c55e"
                    onFocus={() => {
                      setTimeout(() => {
                        orderScrollRef.current?.scrollToEnd({ animated: true });
                      }, 300);
                    }}
                  />
                </View>
                <View style={styles.slTpCol}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Take Profit</Text>
                  <TextInput
                    style={[styles.slTpInputOrder, { backgroundColor: colors.bgSecondary, color: colors.textPrimary, borderColor: colors.border }]}
                    value={takeProfit}
                    onChangeText={(text) => setTakeProfit(text.replace(/[^0-9.]/g, ''))}
                    placeholder="Optional"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numbers-and-punctuation"
                    selectionColor="#22c55e"
                    onFocus={() => {
                      setTimeout(() => {
                        orderScrollRef.current?.scrollToEnd({ animated: true });
                      }, 300);
                    }}
                  />
                </View>
              </View>

              {/* Final Buy/Sell Buttons - Slim */}
              <View style={styles.finalTradeRow}>
                <TouchableOpacity 
                  style={[styles.finalSellBtn, isExecuting && styles.btnDisabled]}
                  onPress={() => { setOrderSide('SELL'); executeTrade(); }}
                  disabled={isExecuting}
                >
                  <Text style={styles.finalBtnText}>
                    {isExecuting ? 'EXECUTING...' : orderType === 'PENDING' ? `SELL ${pendingType}` : 'SELL'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.finalBuyBtn, isExecuting && styles.btnDisabled]}
                  onPress={() => { setOrderSide('BUY'); executeTrade(); }}
                  disabled={isExecuting}
                >
                  <Text style={styles.finalBtnText}>
                    {isExecuting ? 'EXECUTING...' : orderType === 'PENDING' ? `BUY ${pendingType}` : 'BUY'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Account Picker Modal */}
      <Modal visible={showAccountPicker} animationType="slide" transparent onRequestClose={() => setShowAccountPicker(false)}>
        <View style={styles.accountPickerOverlay}>
          <TouchableOpacity style={styles.accountPickerBackdrop} onPress={() => setShowAccountPicker(false)} />
          <View style={[styles.accountPickerContent, { backgroundColor: colors.bgCard }]}>
            <View style={[styles.accountPickerHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.accountPickerTitle, { color: colors.textPrimary }]}>Select Account</Text>
              <TouchableOpacity onPress={() => setShowAccountPicker(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.accountPickerList}>
              {/* Regular Accounts Section */}
              {ctx.accounts && ctx.accounts.length > 0 && (
                <>
                  <Text style={[styles.accountPickerSectionTitle, { color: colors.textMuted }]}>Trading Accounts</Text>
                  {ctx.accounts.map(account => (
                    <TouchableOpacity 
                      key={account._id}
                      style={[styles.accountPickerItem, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }, !ctx.isChallengeMode && ctx.selectedAccount?._id === account._id && styles.accountPickerItemActive]}
                      onPress={() => { 
                        ctx.setIsChallengeMode(false);
                        ctx.setSelectedAccount(account); 
                        setShowAccountPicker(false); 
                      }}
                    >
                      <View style={styles.accountPickerItemLeft}>
                        <View style={[styles.accountPickerIcon, { backgroundColor: colors.bgSecondary }, !ctx.isChallengeMode && ctx.selectedAccount?._id === account._id && styles.accountPickerIconActive]}>
                          <Ionicons name="wallet" size={20} color={!ctx.isChallengeMode && ctx.selectedAccount?._id === account._id ? colors.accent : colors.textMuted} />
                        </View>
                        <View>
                          <Text style={[styles.accountPickerNumber, { color: colors.textPrimary }]}>{account.accountId || account.accountNumber}</Text>
                          <Text style={[styles.accountPickerType, { color: colors.textMuted }]}>{account.accountTypeId?.name || account.accountType || 'Standard'} • {account.leverage}</Text>
                        </View>
                      </View>
                      <View style={styles.accountPickerItemRight}>
                        <Text style={[styles.accountPickerBalance, { color: colors.textPrimary }]}>${(account.balance || 0).toFixed(2)}</Text>
                        {!ctx.isChallengeMode && ctx.selectedAccount?._id === account._id && (
                          <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Challenge Accounts Section */}
              {ctx.challengeAccounts && ctx.challengeAccounts.length > 0 && (
                <>
                  <Text style={[styles.accountPickerSectionTitle, { color: colors.textMuted, marginTop: 16 }]}>Challenge Accounts</Text>
                  {ctx.challengeAccounts.filter(acc => acc.status === 'ACTIVE').map(account => (
                    <TouchableOpacity 
                      key={account._id}
                      style={[styles.accountPickerItem, { backgroundColor: colors.bgCard, borderBottomColor: colors.border, borderLeftWidth: 3, borderLeftColor: '#22c55e' }, ctx.isChallengeMode && ctx.selectedChallengeAccount?._id === account._id && styles.accountPickerItemActive]}
                      onPress={() => { 
                        ctx.setIsChallengeMode(true);
                        ctx.setSelectedChallengeAccount(account); 
                        setShowAccountPicker(false); 
                      }}
                    >
                      <View style={styles.accountPickerItemLeft}>
                        <View style={[styles.accountPickerIcon, { backgroundColor: '#22c55e20' }, ctx.isChallengeMode && ctx.selectedChallengeAccount?._id === account._id && { backgroundColor: '#22c55e40' }]}>
                          <Ionicons name="trophy" size={20} color="#22c55e" />
                        </View>
                        <View>
                          <Text style={[styles.accountPickerNumber, { color: colors.textPrimary }]}>{account.accountId}</Text>
                          <Text style={[styles.accountPickerType, { color: colors.textMuted }]}>{account.challengeId?.name || 'Challenge'} • Step {account.currentStep || 1}</Text>
                        </View>
                      </View>
                      <View style={styles.accountPickerItemRight}>
                        <Text style={[styles.accountPickerBalance, { color: colors.textPrimary }]}>${(account.currentBalance || account.balance || 0).toFixed(2)}</Text>
                        {ctx.isChallengeMode && ctx.selectedChallengeAccount?._id === account._id && (
                          <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* No accounts message */}
              {(!ctx.accounts || ctx.accounts.length === 0) && (!ctx.challengeAccounts || ctx.challengeAccounts.length === 0) && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Ionicons name="wallet-outline" size={48} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, marginTop: 10 }}>No accounts available</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 5 }}>Please create an account first</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Quick Stop Loss Modal for Challenge Accounts */}
      <Modal visible={showQuickSlModal} animationType="fade" transparent onRequestClose={() => setShowQuickSlModal(false)}>
        <View style={styles.quickSlModalOverlay}>
          <View style={[styles.quickSlModalContent, { backgroundColor: colors.bgCard }]}>
            <View style={styles.quickSlModalHeader}>
              <Ionicons name="warning" size={24} color="#f59e0b" />
              <Text style={[styles.quickSlModalTitle, { color: colors.textPrimary }]}>Stop Loss Required</Text>
            </View>
            <Text style={[styles.quickSlModalSubtitle, { color: colors.textMuted }]}>
              Stop Loss is mandatory for challenge accounts. Please set a stop loss price before placing your trade.
            </Text>
            
            <View style={styles.quickSlInputContainer}>
              <Text style={[styles.quickSlInputLabel, { color: colors.textMuted }]}>Stop Loss Price</Text>
              <TextInput
                style={[styles.quickSlInput, { backgroundColor: colors.bgSecondary, color: colors.textPrimary, borderColor: colors.border }]}
                value={quickSlValue}
                onChangeText={(text) => setQuickSlValue(text.replace(/[^0-9.]/g, ''))}
                placeholder={`e.g. ${pendingQuickTradeSide === 'BUY' 
                  ? (ctx.livePrices[selectedInstrument?.symbol]?.bid * 0.99)?.toFixed(selectedInstrument?.category === 'Forex' ? 5 : 2) 
                  : (ctx.livePrices[selectedInstrument?.symbol]?.ask * 1.01)?.toFixed(selectedInstrument?.category === 'Forex' ? 5 : 2)}`}
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
              />
              <Text style={[styles.quickSlHint, { color: colors.textMuted }]}>
                Current {pendingQuickTradeSide === 'BUY' ? 'Bid' : 'Ask'}: {pendingQuickTradeSide === 'BUY' 
                  ? ctx.livePrices[selectedInstrument?.symbol]?.bid?.toFixed(selectedInstrument?.category === 'Forex' ? 5 : 2) 
                  : ctx.livePrices[selectedInstrument?.symbol]?.ask?.toFixed(selectedInstrument?.category === 'Forex' ? 5 : 2)}
              </Text>
            </View>

            <View style={styles.quickSlModalButtons}>
              <TouchableOpacity 
                style={[styles.quickSlCancelBtn, { backgroundColor: colors.bgSecondary }]}
                onPress={() => {
                  setShowQuickSlModal(false);
                  setPendingQuickTradeSide(null);
                  setQuickSlValue('');
                }}
              >
                <Text style={[styles.quickSlCancelBtnText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.quickSlConfirmBtn, { backgroundColor: pendingQuickTradeSide === 'BUY' ? '#22c55e' : '#ef4444' }]}
                onPress={() => {
                  if (!quickSlValue || isNaN(parseFloat(quickSlValue))) {
                    toast?.showToast('Please enter a valid stop loss price', 'warning');
                    return;
                  }
                  const slValue = quickSlValue;
                  const tradeSide = pendingQuickTradeSide;
                  setStopLoss(slValue);
                  setOrderSide(tradeSide);
                  setOrderType('MARKET');
                  setShowQuickSlModal(false);
                  setPendingQuickTradeSide(null);
                  setQuickSlValue('');
                  // Execute trade with SL and side passed directly (avoid async state issues)
                  setTimeout(() => executeTrade(slValue, tradeSide), 100);
                }}
              >
                <Text style={styles.quickSlConfirmBtnText}>
                  {pendingQuickTradeSide === 'BUY' ? 'BUY' : 'SELL'} with SL
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// TRADE TAB - Account summary + Positions/Pending/History (like mobile web view)
const TradeTab = () => {
  const ctx = React.useContext(TradingContext);
  const { colors } = useTheme();
  const toast = useToast();
  const [tradeTab, setTradeTab] = useState('positions');
  const [showSlTpModal, setShowSlTpModal] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [closingTradeId, setClosingTradeId] = useState(null);
  const [showCloseAllModal, setShowCloseAllModal] = useState(false);
  const [closeAllType, setCloseAllType] = useState('all');
  const [isClosingAll, setIsClosingAll] = useState(false);
  const [showKillSwitch, setShowKillSwitch] = useState(false);
  const [isKillSwitchActive, setIsKillSwitchActive] = useState(false);
  const [showTradeDetails, setShowTradeDetails] = useState(false);
  const [detailTrade, setDetailTrade] = useState(null);
  const [showHistoryDetails, setShowHistoryDetails] = useState(false);
  const [historyDetailTrade, setHistoryDetailTrade] = useState(null);
  
  // History filter states
  const [historyFilter, setHistoryFilter] = useState('all');

  const totalUsedMargin = ctx.openTrades.reduce((sum, trade) => sum + (trade.marginUsed || 0), 0);
  
  // Filter trade history based on selected filter
  const getFilteredHistory = () => {
    const now = new Date();
    return ctx.tradeHistory.filter(trade => {
      const tradeDate = new Date(trade.closedAt);
      if (historyFilter === 'all') return true;
      if (historyFilter === 'today') {
        return tradeDate.toDateString() === now.toDateString();
      }
      if (historyFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return tradeDate >= weekAgo;
      }
      if (historyFilter === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return tradeDate >= monthAgo;
      }
      if (historyFilter === 'year') {
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        return tradeDate >= yearAgo;
      }
      return true;
    });
  };

  // Calculate total P&L for filtered history
  const getHistoryTotalPnl = () => {
    return getFilteredHistory().reduce((sum, trade) => sum + (trade.realizedPnl || 0), 0);
  };

  // Calculate PnL for a trade
  const calculatePnl = (trade) => {
    const prices = ctx.livePrices[trade.symbol];
    if (!prices?.bid || !prices?.ask) return 0;
    const currentPrice = trade.side === 'BUY' ? prices.bid : prices.ask;
    return trade.side === 'BUY'
      ? (currentPrice - trade.openPrice) * trade.quantity * trade.contractSize
      : (trade.openPrice - currentPrice) * trade.quantity * trade.contractSize;
  };

  // Close single trade
  const closeTrade = async (trade) => {
    if (closingTradeId) return;
    const prices = ctx.livePrices[trade.symbol];
    if (!prices?.bid || !prices?.ask) {
      toast?.showToast('No price data available', 'error');
      return;
    }
    
    setClosingTradeId(trade._id);
    try {
      const res = await fetch(`${API_URL}/trade/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeId: trade._id,
          bid: prices.bid,
          ask: prices.ask
        })
      });
      const data = await res.json();
      if (data.success) {
        const pnl = data.trade?.realizedPnl || data.realizedPnl || 0;
        toast?.showToast(`Closed! P/L: $${pnl.toFixed(2)}`, pnl >= 0 ? 'success' : 'warning');
        ctx.fetchOpenTrades();
        ctx.fetchTradeHistory();
        ctx.fetchAccountSummary();
      } else {
        toast?.showToast(data.message || 'Failed to close', 'error');
      }
    } catch (e) {
      console.error('Close trade error:', e);
      toast?.showToast('Failed to close trade', 'error');
    } finally {
      setClosingTradeId(null);
    }
  };

  // Close all trades (all, profit, or loss)
  const closeAllTrades = async (type) => {
    setCloseAllType(type);
    setShowCloseAllModal(true);
  };

  const confirmCloseAll = async () => {
    setIsClosingAll(true);
    const tradesToClose = ctx.openTrades.filter(trade => {
      const pnl = calculatePnl(trade);
      if (closeAllType === 'profit') return pnl > 0;
      if (closeAllType === 'loss') return pnl < 0;
      return true;
    });

    let closedCount = 0;
    for (const trade of tradesToClose) {
      const prices = ctx.livePrices[trade.symbol];
      if (!prices?.bid || !prices?.ask) continue;
      
      try {
        const res = await fetch(`${API_URL}/trade/close`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tradeId: trade._id,
            bid: prices.bid,
            ask: prices.ask
          })
        });
        const data = await res.json();
        if (data.success) closedCount++;
      } catch (e) {
        console.error('Close trade error:', e);
      }
    }

    setShowCloseAllModal(false);
    setIsClosingAll(false);
    toast?.showToast(`Closed ${closedCount} trade(s)`, 'success');
    ctx.fetchOpenTrades();
    ctx.fetchTradeHistory();
    ctx.fetchAccountSummary();
  };

  // Kill Switch - Close all trades and cancel all pending orders
  const executeKillSwitch = async () => {
    setIsKillSwitchActive(true);
    let closedTrades = 0;
    let cancelledOrders = 0;

    // Close all open trades
    for (const trade of ctx.openTrades) {
      const prices = ctx.livePrices[trade.symbol];
      if (!prices?.bid || !prices?.ask) continue;
      try {
        const res = await fetch(`${API_URL}/trade/close`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tradeId: trade._id, bid: prices.bid, ask: prices.ask })
        });
        const data = await res.json();
        if (data.success) closedTrades++;
      } catch (e) {
        console.error('Kill switch close error:', e);
      }
    }

    // Cancel all pending orders
    for (const order of ctx.pendingOrders) {
      try {
        const res = await fetch(`${API_URL}/trade/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tradeId: order._id })
        });
        const data = await res.json();
        if (data.success) cancelledOrders++;
      } catch (e) {
        console.error('Kill switch cancel error:', e);
      }
    }

    setShowKillSwitch(false);
    setIsKillSwitchActive(false);
    toast?.showToast(`Kill Switch: Closed ${closedTrades} trades, cancelled ${cancelledOrders} orders`, 'warning');
    ctx.fetchOpenTrades();
    ctx.fetchPendingOrders();
    ctx.fetchTradeHistory();
    ctx.fetchAccountSummary();
  };

  const openSlTpModal = (trade) => {
    setSelectedTrade(trade);
    // Check both sl/stopLoss and tp/takeProfit fields for compatibility (like web app)
    setStopLoss((trade.sl || trade.stopLoss)?.toString() || '');
    setTakeProfit((trade.tp || trade.takeProfit)?.toString() || '');
    setShowSlTpModal(true);
  };

  const updateSlTp = async () => {
    if (!selectedTrade) return;
    try {
      const slValue = stopLoss && stopLoss.trim() !== '' ? parseFloat(stopLoss) : null;
      const tpValue = takeProfit && takeProfit.trim() !== '' ? parseFloat(takeProfit) : null;
      
      console.log('Updating SL/TP:', { tradeId: selectedTrade._id, sl: slValue, tp: tpValue });
      
      const res = await fetch(`${API_URL}/trade/modify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeId: selectedTrade._id,
          sl: slValue,
          tp: tpValue
        })
      });
      const data = await res.json();
      console.log('SL/TP update response:', data);
      
      if (data.success) {
        toast?.showToast('SL/TP updated successfully', 'success');
        setShowSlTpModal(false);
        setSelectedTrade(null);
        ctx.fetchOpenTrades();
      } else {
        toast?.showToast(data.message || 'Failed to update SL/TP', 'error');
      }
    } catch (e) {
      console.error('Update SL/TP error:', e);
      toast?.showToast('Network error', 'error');
    }
  };

  // Cancel pending order
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const cancelPendingOrder = async (order) => {
    if (cancellingOrderId) return;
    setCancellingOrderId(order._id);
    try {
      const res = await fetch(`${API_URL}/trade/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId: order._id })
      });
      const data = await res.json();
      if (data.success) {
        toast?.showToast('Order cancelled', 'success');
        ctx.fetchPendingOrders();
      } else {
        toast?.showToast(data.message || 'Failed to cancel order', 'error');
      }
    } catch (e) {
      toast?.showToast('Network error', 'error');
    } finally {
      setCancellingOrderId(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Account Summary - Like mobile web view */}
      <View style={[styles.accountSummaryList, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Balance</Text>
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{(ctx.accountSummary.balance || (ctx.isChallengeMode ? ctx.selectedChallengeAccount?.balance : ctx.selectedAccount?.balance) || 0).toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Equity</Text>
          <Text style={[styles.summaryValue, { color: ctx.totalFloatingPnl >= 0 ? '#22c55e' : '#ef4444' }]}>
            {ctx.realTimeEquity.toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Credit</Text>
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{(ctx.accountSummary.credit || 0).toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Used Margin</Text>
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{totalUsedMargin.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Free Margin</Text>
          <Text style={[styles.summaryValue, { color: colors.accent }]}>
            {ctx.realTimeFreeMargin.toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Floating PL</Text>
          <Text style={[styles.summaryValue, { color: ctx.totalFloatingPnl >= 0 ? '#22c55e' : '#ef4444' }]}>
            {ctx.totalFloatingPnl.toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Today's P&L</Text>
          <Text style={[styles.summaryValue, { color: ctx.todayPnl >= 0 ? '#22c55e' : '#ef4444' }]}>
            {ctx.todayPnl >= 0 ? '+' : ''}{ctx.todayPnl?.toFixed(2) || '0.00'}
          </Text>
        </View>
      </View>

      {/* Trade Tabs - Positions / Pending / History */}
      <View style={[styles.tradeTabs, { backgroundColor: colors.bgSecondary }]}>
        {['positions', 'pending', 'history'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tradeTabBtn, tradeTab === tab && styles.tradeTabBtnActive]}
            onPress={() => setTradeTab(tab)}
          >
            <Text style={[styles.tradeTabText, { color: colors.textMuted }, tradeTab === tab && styles.tradeTabTextActive]}>
              {tab === 'positions' ? `Positions (${ctx.openTrades.length})` :
               tab === 'pending' ? `Pending (${ctx.pendingOrders.length})` : 'History'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Close All Buttons - Only show when positions tab is active and has trades */}
      {tradeTab === 'positions' && ctx.openTrades.length > 0 && (
        <View style={[styles.closeAllRow, { backgroundColor: colors.bgSecondary }]}>
          <TouchableOpacity style={styles.closeAllBtn} onPress={() => closeAllTrades('all')}>
            <Text style={styles.closeAllText}>Close All ({ctx.openTrades.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeProfitBtn} onPress={() => closeAllTrades('profit')}>
            <Text style={styles.closeProfitText}>Close Profit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeLossBtn} onPress={() => closeAllTrades('loss')}>
            <Text style={styles.closeLossText}>Close Loss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      <ScrollView style={styles.tradesList}>
        {tradeTab === 'positions' && (
          ctx.openTrades.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="trending-up-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No open positions</Text>
            </View>
          ) : (
            ctx.openTrades.map(trade => {
              const pnl = ctx.calculatePnl(trade);
              const prices = ctx.livePrices[trade.symbol];
              const currentPrice = trade.side === 'BUY' ? prices?.bid : prices?.ask;
              
              const renderRightActions = (progress, dragX) => {
                return (
                  <TouchableOpacity 
                    style={styles.swipeCloseBtn} 
                    onPress={() => closeTrade(trade)}
                  >
                    <Ionicons name="close-circle" size={24} color="#fff" />
                    <Text style={styles.swipeCloseText}>Close</Text>
                  </TouchableOpacity>
                );
              };
              
              return (
                <Swipeable 
                  key={trade._id} 
                  renderRightActions={renderRightActions}
                  rightThreshold={40}
                  overshootRight={false}
                >
                  <TouchableOpacity style={[styles.positionItem, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]} onPress={() => { setDetailTrade(trade); setShowTradeDetails(true); }}>
                    <View style={styles.positionRow}>
                      <View style={styles.positionInfo}>
                        <View style={styles.positionSymbolRow}>
                          <Text style={[styles.positionSymbol, { color: colors.textPrimary }]}>{trade.symbol}</Text>
                          <View style={[styles.sideBadge, { backgroundColor: trade.side === 'BUY' ? '#22c55e20' : '#ef444420' }]}>
                            <Text style={[styles.sideText, { color: trade.side === 'BUY' ? '#22c55e' : '#ef4444' }]}>{trade.side}</Text>
                          </View>
                        </View>
                        <Text style={[styles.positionDetail, { color: colors.textMuted }]}>{trade.quantity} lots @ {trade.openPrice?.toFixed(5)}</Text>
                        {(trade.sl || trade.stopLoss || trade.tp || trade.takeProfit) && (
                          <Text style={[styles.slTpText, { color: colors.textMuted }]}>
                            {(trade.sl || trade.stopLoss) ? `SL: ${trade.sl || trade.stopLoss}` : ''} {(trade.tp || trade.takeProfit) ? `TP: ${trade.tp || trade.takeProfit}` : ''}
                          </Text>
                        )}
                      </View>
                      <View style={styles.positionActions}>
                        <TouchableOpacity style={styles.editBtn} onPress={(e) => { e.stopPropagation(); openSlTpModal(trade); }}>
                          <Ionicons name="pencil" size={16} color={colors.accent} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.positionPnlCol}>
                        <Text style={[styles.positionPnl, { color: pnl >= 0 ? '#22c55e' : '#ef4444' }]}>
                          ${pnl >= 0 ? '' : '-'}{Math.abs(pnl).toFixed(2)}
                        </Text>
                        <Text style={[styles.currentPriceText, { color: colors.textMuted }]}>{currentPrice?.toFixed(5) || '-'}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              );
            })
          )
        )}

        {tradeTab === 'pending' && (
          ctx.pendingOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No pending orders</Text>
            </View>
          ) : (
            ctx.pendingOrders.map(order => (
              <View key={order._id} style={[styles.positionItem, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
                <View style={styles.positionRow}>
                  <View style={styles.positionInfo}>
                    <View style={styles.positionSymbolRow}>
                      <Text style={[styles.positionSymbol, { color: colors.textPrimary }]}>{order.symbol}</Text>
                      <View style={[styles.sideBadge, { backgroundColor: '#eab30820' }]}>
                        <Text style={[styles.sideText, { color: '#eab308' }]}>{order.orderType}</Text>
                      </View>
                    </View>
                    <Text style={[styles.positionDetail, { color: colors.textMuted }]}>{order.quantity} lots @ {order.pendingPrice?.toFixed(5)}</Text>
                    {(order.sl || order.stopLoss || order.tp || order.takeProfit) && (
                      <Text style={[styles.slTpText, { color: colors.textMuted }]}>
                        {(order.sl || order.stopLoss) ? `SL: ${order.sl || order.stopLoss}` : ''} {(order.tp || order.takeProfit) ? `TP: ${order.tp || order.takeProfit}` : ''}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity 
                    style={[styles.cancelOrderBtn, cancellingOrderId === order._id && styles.btnDisabled]} 
                    onPress={() => cancelPendingOrder(order)}
                    disabled={cancellingOrderId === order._id}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.accent} />
                    <Text style={[styles.cancelOrderText, { color: colors.accent }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        )}

        {tradeTab === 'history' && (
          <>
            {/* History Filter Buttons */}
            <View style={[styles.historyFilters, { backgroundColor: colors.bgSecondary, borderBottomColor: colors.border }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyFiltersContent}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'today', label: 'Today' },
                  { key: 'week', label: 'This Week' },
                  { key: 'month', label: 'This Month' },
                  { key: 'year', label: 'This Year' }
                ].map(filter => (
                  <TouchableOpacity
                    key={filter.key}
                    style={[
                      styles.historyFilterBtn,
                      { backgroundColor: historyFilter === filter.key ? '#22c55e' : colors.bgCard }
                    ]}
                    onPress={() => setHistoryFilter(filter.key)}
                  >
                    <Text style={[
                      styles.historyFilterText,
                      { color: historyFilter === filter.key ? '#000' : colors.textMuted }
                    ]}>
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            
            {/* History Summary */}
            <View style={[styles.historySummary, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
              <Text style={[styles.historySummaryText, { color: colors.textMuted }]}>
                {getFilteredHistory().length} trades
              </Text>
              <Text style={[styles.historySummaryText, { color: colors.textMuted }]}>
                P&L: <Text style={{ color: getHistoryTotalPnl() >= 0 ? '#22c55e' : '#ef4444', fontWeight: '600' }}>
                  ${getHistoryTotalPnl().toFixed(2)}
                </Text>
              </Text>
            </View>

            {getFilteredHistory().length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No trade history</Text>
              </View>
            ) : (
              getFilteredHistory().map(trade => (
                <TouchableOpacity 
                  key={trade._id} 
                  style={[styles.historyItem, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}
                  onPress={() => { setHistoryDetailTrade(trade); setShowHistoryDetails(true); }}
                >
                  <View style={styles.historyHeader}>
                    <View style={styles.historyLeft}>
                      <Text style={[styles.historySymbol, { color: colors.textPrimary }]}>{trade.symbol}</Text>
                      <Text style={[styles.historySide, { color: trade.side === 'BUY' ? '#22c55e' : '#ef4444' }]}>{trade.side}</Text>
                      {trade.closedBy === 'ADMIN' && (
                        <View style={styles.adminBadge}>
                          <Text style={styles.adminBadgeText}>Admin Close</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.historyPnl, { color: (trade.realizedPnl || 0) >= 0 ? '#22c55e' : '#ef4444' }]}>
                      {(trade.realizedPnl || 0) >= 0 ? '+' : ''}${(trade.realizedPnl || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.historyDetails}>
                    <Text style={[styles.historyDetail, { color: colors.textMuted }]}>{trade.quantity} lots</Text>
                    <Text style={[styles.historyDetail, { color: colors.textMuted }]}>{new Date(trade.closedAt).toLocaleDateString()}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* SL/TP Modal */}
      <Modal visible={showSlTpModal} animationType="slide" transparent onRequestClose={() => setShowSlTpModal(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.slTpModalOverlay}
        >
          <TouchableOpacity 
            style={styles.slTpModalBackdrop} 
            activeOpacity={1} 
            onPress={() => { Keyboard.dismiss(); setShowSlTpModal(false); }}
          />
          <View style={styles.slTpModalContent}>
            <View style={styles.slTpModalHandle} />
            <View style={styles.slTpModalHeader}>
              <Text style={styles.slTpModalTitle}>
                {selectedTrade?.symbol} - Set SL/TP
              </Text>
              <TouchableOpacity onPress={() => { setShowSlTpModal(false); Keyboard.dismiss(); }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.slTpInputGroup}>
              <Text style={styles.slTpLabel}>Stop Loss</Text>
              <TextInput
                style={styles.slTpInput}
                value={stopLoss}
                onChangeText={(text) => setStopLoss(text.replace(/[^0-9.]/g, ''))}
                placeholder="Enter stop loss price"
                placeholderTextColor="#666"
                keyboardType="numbers-and-punctuation"
                returnKeyType="next"
                autoCorrect={false}
                autoCapitalize="none"
                selectionColor="#22c55e"
                editable={true}
              />
            </View>
            
            <View style={styles.slTpInputGroup}>
              <Text style={styles.slTpLabel}>Take Profit</Text>
              <TextInput
                style={styles.slTpInput}
                value={takeProfit}
                onChangeText={(text) => setTakeProfit(text.replace(/[^0-9.]/g, ''))}
                placeholder="Enter take profit price"
                placeholderTextColor="#666"
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
                autoCorrect={false}
                autoCapitalize="none"
                selectionColor="#22c55e"
                editable={true}
                onSubmitEditing={updateSlTp}
              />
            </View>

            <View style={styles.slTpCurrentInfo}>
              <Text style={styles.slTpCurrentText}>
                Open: {selectedTrade?.openPrice?.toFixed(5) || '-'}
              </Text>
              <Text style={styles.slTpCurrentText}>
                {selectedTrade?.side || '-'} | {selectedTrade?.quantity || 0} lots
              </Text>
            </View>
            
            <View style={styles.slTpButtonRow}>
              <TouchableOpacity 
                style={styles.slTpClearBtn} 
                onPress={() => { setStopLoss(''); setTakeProfit(''); }}
              >
                <Text style={styles.slTpClearBtnText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.slTpSaveBtn} onPress={updateSlTp}>
                <Text style={styles.slTpSaveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Trade Details Modal */}
      <Modal visible={showTradeDetails} animationType="slide" transparent onRequestClose={() => setShowTradeDetails(false)}>
        <View style={styles.slTpModalOverlay}>
          <TouchableOpacity style={styles.slTpModalBackdrop} activeOpacity={1} onPress={() => setShowTradeDetails(false)} />
          <View style={[styles.tradeDetailsContent, { backgroundColor: colors.bgCard }]}>
            <View style={[styles.slTpModalHandle, { backgroundColor: colors.border }]} />
            <View style={styles.slTpModalHeader}>
              <Text style={[styles.slTpModalTitle, { color: colors.textPrimary }]}>{detailTrade?.symbol} Trade Details</Text>
              <TouchableOpacity onPress={() => setShowTradeDetails(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            {detailTrade && (
              <ScrollView style={styles.tradeDetailsScroll}>
                {/* Trade ID & Status */}
                <View style={[styles.detailSection, { backgroundColor: colors.bgSecondary }]}>
                  <Text style={[styles.detailSectionTitle, { color: colors.primary }]}>Trade Info</Text>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Trade ID</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{detailTrade.tradeId}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Status</Text>
                    <Text style={[styles.detailValue, { color: '#22c55e' }]}>{detailTrade.status}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Side</Text>
                    <Text style={[styles.detailValue, { color: detailTrade.side === 'BUY' ? '#22c55e' : '#ef4444' }]}>{detailTrade.side}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Order Type</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{detailTrade.orderType}</Text>
                  </View>
                </View>

                {/* Position Details */}
                <View style={[styles.detailSection, { backgroundColor: colors.bgSecondary }]}>
                  <Text style={[styles.detailSectionTitle, { color: colors.primary }]}>Position</Text>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Volume</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{detailTrade.quantity} lots</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Open Price</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{detailTrade.openPrice?.toFixed(5)}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Current Price</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                      {(detailTrade.side === 'BUY' ? ctx.livePrices[detailTrade.symbol]?.bid : ctx.livePrices[detailTrade.symbol]?.ask)?.toFixed(5) || '-'}
                    </Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Contract Size</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{detailTrade.contractSize?.toLocaleString()}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Leverage</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>1:{detailTrade.leverage}</Text>
                  </View>
                </View>

                {/* SL/TP */}
                <View style={[styles.detailSection, { backgroundColor: colors.bgSecondary }]}>
                  <Text style={[styles.detailSectionTitle, { color: colors.primary }]}>Stop Loss / Take Profit</Text>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Stop Loss</Text>
                    <Text style={[styles.detailValue, { color: (detailTrade.sl || detailTrade.stopLoss) ? '#22c55e' : colors.textMuted }]}>
                      {detailTrade.sl || detailTrade.stopLoss || 'Not Set'}
                    </Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Take Profit</Text>
                    <Text style={[styles.detailValue, { color: (detailTrade.tp || detailTrade.takeProfit) ? '#22c55e' : colors.textMuted }]}>
                      {detailTrade.tp || detailTrade.takeProfit || 'Not Set'}
                    </Text>
                  </View>
                </View>

                {/* Charges */}
                <View style={[styles.detailSection, { backgroundColor: colors.bgSecondary }]}>
                  <Text style={[styles.detailSectionTitle, { color: colors.primary }]}>Charges</Text>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Margin Used</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>${detailTrade.marginUsed?.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Spread</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{detailTrade.spread || 0} pips</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Commission</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>${detailTrade.commission?.toFixed(2) || '0.00'}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Swap</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>${detailTrade.swap?.toFixed(2) || '0.00'}</Text>
                  </View>
                </View>

                {/* P&L */}
                <View style={[styles.detailSection, { backgroundColor: colors.bgSecondary }]}>
                  <Text style={[styles.detailSectionTitle, { color: colors.primary }]}>Profit & Loss</Text>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Floating P&L</Text>
                    <Text style={[styles.detailValue, { color: ctx.calculatePnl(detailTrade) >= 0 ? '#22c55e' : '#ef4444', fontWeight: 'bold' }]}>
                      ${ctx.calculatePnl(detailTrade).toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Time */}
                <View style={[styles.detailSection, { backgroundColor: colors.bgSecondary }]}>
                  <Text style={[styles.detailSectionTitle, { color: colors.primary }]}>Time</Text>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Opened At</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{new Date(detailTrade.openedAt || detailTrade.createdAt).toLocaleString()}</Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.detailActions}>
                  <TouchableOpacity 
                    style={styles.detailEditBtn} 
                    onPress={() => { setShowTradeDetails(false); openSlTpModal(detailTrade); }}
                  >
                    <Ionicons name="pencil" size={18} color="#22c55e" />
                    <Text style={styles.detailEditText}>Edit SL/TP</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.detailCloseBtn} 
                    onPress={() => { setShowTradeDetails(false); closeTrade(detailTrade); }}
                  >
                    <Ionicons name="close-circle" size={18} color="#fff" />
                    <Text style={styles.detailCloseText}>Close Trade</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Close All Confirmation Modal */}
      <Modal visible={showCloseAllModal} animationType="fade" transparent onRequestClose={() => setShowCloseAllModal(false)}>
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={[styles.confirmModalIcon, { backgroundColor: closeAllType === 'profit' ? '#22c55e20' : closeAllType === 'loss' ? '#22c55e20' : '#22c55e20' }]}>
              <Ionicons name={closeAllType === 'profit' ? 'trending-up' : closeAllType === 'loss' ? 'trending-down' : 'close-circle'} size={32} color={closeAllType === 'profit' ? '#22c55e' : closeAllType === 'loss' ? '#22c55e' : '#22c55e'} />
            </View>
            <Text style={styles.confirmModalTitle}>
              {closeAllType === 'all' && 'Close All Trades?'}
              {closeAllType === 'profit' && 'Close Winning Trades?'}
              {closeAllType === 'loss' && 'Close Losing Trades?'}
            </Text>
            <Text style={styles.confirmModalMessage}>
              {closeAllType === 'all' && `This will close all ${ctx.openTrades.length} open trade(s)`}
              {closeAllType === 'profit' && 'This will close all trades currently in profit'}
              {closeAllType === 'loss' && 'This will close all trades currently in loss'}
            </Text>
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setShowCloseAllModal(false)} disabled={isClosingAll}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmCloseBtn, { backgroundColor: closeAllType === 'profit' ? '#22c55e' : closeAllType === 'loss' ? '#22c55e' : '#22c55e' }, isClosingAll && styles.btnDisabled]} 
                onPress={confirmCloseAll}
                disabled={isClosingAll}
              >
                <Text style={styles.confirmCloseText}>{isClosingAll ? 'Closing...' : 'Confirm'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* History Trade Details Modal */}
      <Modal visible={showHistoryDetails} animationType="slide" transparent onRequestClose={() => setShowHistoryDetails(false)}>
        <View style={styles.slTpModalOverlay}>
          <TouchableOpacity style={styles.slTpModalBackdrop} activeOpacity={1} onPress={() => setShowHistoryDetails(false)} />
          <View style={[styles.tradeDetailsContent, { backgroundColor: colors.bgCard }]}>
            <View style={[styles.slTpModalHandle, { backgroundColor: colors.border }]} />
            <View style={styles.slTpModalHeader}>
              <Text style={[styles.slTpModalTitle, { color: colors.textPrimary }]}>{historyDetailTrade?.symbol} - Closed Trade</Text>
              <TouchableOpacity onPress={() => setShowHistoryDetails(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            {historyDetailTrade && (
              <ScrollView style={styles.tradeDetailsScroll}>
                {/* Trade Info */}
                <View style={[styles.detailSection, { backgroundColor: colors.bgSecondary }]}>
                  <Text style={[styles.detailSectionTitle, { color: colors.primary }]}>Trade Info</Text>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Trade ID</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{historyDetailTrade.tradeId}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Status</Text>
                    <Text style={[styles.detailValue, { color: colors.textMuted }]}>{historyDetailTrade.status}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Side</Text>
                    <Text style={[styles.detailValue, { color: historyDetailTrade.side === 'BUY' ? '#22c55e' : '#ef4444' }]}>{historyDetailTrade.side}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Order Type</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{historyDetailTrade.orderType}</Text>
                  </View>
                  {/* Closed By - Show for all close types */}
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Closed By</Text>
                    <Text style={[styles.detailValue, { 
                      color: historyDetailTrade.closedBy === 'STOP_OUT' ? '#ef4444' : 
                             historyDetailTrade.closedBy === 'SL' ? '#ef4444' : 
                             historyDetailTrade.closedBy === 'TP' ? '#22c55e' : 
                             historyDetailTrade.closedBy === 'ADMIN' ? '#f59e0b' : colors.textMuted
                    }]}>
                      {historyDetailTrade.closedBy === 'STOP_OUT' ? '⚠️ Stop Out (Equity Zero)' :
                       historyDetailTrade.closedBy === 'SL' ? '🔴 Stop Loss Hit' :
                       historyDetailTrade.closedBy === 'TP' ? '🟢 Take Profit Hit' :
                       historyDetailTrade.closedBy === 'ADMIN' ? '👤 Admin Close' :
                       historyDetailTrade.closedBy === 'USER' ? '👤 Manual Close' :
                       historyDetailTrade.closedBy || 'Manual Close'}
                    </Text>
                  </View>
                </View>

                {/* Position Details */}
                <View style={[styles.detailSection, { backgroundColor: colors.bgSecondary }]}>
                  <Text style={[styles.detailSectionTitle, { color: colors.primary }]}>Position</Text>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Volume</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{historyDetailTrade.quantity} lots</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Open Price</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{historyDetailTrade.openPrice?.toFixed(5)}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Close Price</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{historyDetailTrade.closePrice?.toFixed(5)}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Contract Size</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{historyDetailTrade.contractSize?.toLocaleString()}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Leverage</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>1:{historyDetailTrade.leverage}</Text>
                  </View>
                </View>

                {/* SL/TP */}
                <View style={[styles.detailSection, { backgroundColor: colors.bgSecondary }]}>
                  <Text style={[styles.detailSectionTitle, { color: colors.primary }]}>Stop Loss / Take Profit</Text>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Stop Loss</Text>
                    <Text style={[styles.detailValue, { color: (historyDetailTrade.sl || historyDetailTrade.stopLoss) ? '#22c55e' : colors.textMuted }]}>
                      {historyDetailTrade.sl || historyDetailTrade.stopLoss || 'Not Set'}
                    </Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Take Profit</Text>
                    <Text style={[styles.detailValue, { color: (historyDetailTrade.tp || historyDetailTrade.takeProfit) ? '#22c55e' : colors.textMuted }]}>
                      {historyDetailTrade.tp || historyDetailTrade.takeProfit || 'Not Set'}
                    </Text>
                  </View>
                </View>

                {/* Charges */}
                <View style={[styles.detailSection, { backgroundColor: colors.bgSecondary }]}>
                  <Text style={[styles.detailSectionTitle, { color: colors.primary }]}>Charges</Text>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Margin Used</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>${historyDetailTrade.marginUsed?.toFixed(2) || '0.00'}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Spread</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{historyDetailTrade.spread || 0} pips</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Commission</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>${historyDetailTrade.commission?.toFixed(2) || '0.00'}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Swap</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>${historyDetailTrade.swap?.toFixed(2) || '0.00'}</Text>
                  </View>
                </View>

                {/* P&L */}
                <View style={[styles.detailSection, { backgroundColor: colors.bgSecondary }]}>
                  <Text style={[styles.detailSectionTitle, { color: colors.primary }]}>Realized Profit & Loss</Text>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Realized P&L</Text>
                    <Text style={[styles.detailValue, { color: (historyDetailTrade.realizedPnl || 0) >= 0 ? '#22c55e' : '#ef4444', fontWeight: 'bold', fontSize: 18 }]}>
                      {(historyDetailTrade.realizedPnl || 0) >= 0 ? '+' : ''}${(historyDetailTrade.realizedPnl || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Time */}
                <View style={[styles.detailSection, { backgroundColor: colors.bgSecondary }]}>
                  <Text style={[styles.detailSectionTitle, { color: colors.primary }]}>Time</Text>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Opened At</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{new Date(historyDetailTrade.openedAt || historyDetailTrade.createdAt).toLocaleString()}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Closed At</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{new Date(historyDetailTrade.closedAt).toLocaleString()}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Duration</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                      {(() => {
                        const openTime = new Date(historyDetailTrade.openedAt || historyDetailTrade.createdAt);
                        const closeTime = new Date(historyDetailTrade.closedAt);
                        const diffMs = closeTime - openTime;
                        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                        return diffHrs > 0 ? `${diffHrs}h ${diffMins}m` : `${diffMins}m`;
                      })()}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
};

// HISTORY TAB
const HistoryTab = () => {
  const ctx = React.useContext(TradingContext);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await ctx.fetchTradeHistory();
    setRefreshing(false);
  };

  return (
    <FlatList
      style={styles.container}
      data={ctx.tradeHistory}
      keyExtractor={item => item._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color="#666" />
          <Text style={styles.emptyText}>No trade history</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.historyItemFull}>
          <View style={styles.historyHeader}>
            <View style={styles.historyLeft}>
              <Text style={styles.historySymbol}>{item.symbol}</Text>
              <View style={[styles.sideBadge, { backgroundColor: item.side === 'BUY' ? '#22c55e20' : '#22c55e20' }]}>
                <Text style={[styles.sideText, { color: item.side === 'BUY' ? '#22c55e' : '#22c55e' }]}>{item.side}</Text>
              </View>
              {item.closedBy === 'ADMIN' && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>Admin Close</Text>
                </View>
              )}
            </View>
            <Text style={[styles.historyPnl, { color: (item.realizedPnl || 0) >= 0 ? '#22c55e' : '#ef4444' }]}>
              {(item.realizedPnl || 0) >= 0 ? '+' : ''}${(item.realizedPnl || 0).toFixed(2)}
            </Text>
          </View>
          <View style={styles.historyMeta}>
            <Text style={styles.historyMetaText}>{item.quantity} lots</Text>
            <Text style={styles.historyMetaText}>Open: {item.openPrice?.toFixed(5)}</Text>
            <Text style={styles.historyMetaText}>Close: {item.closePrice?.toFixed(5)}</Text>
          </View>
          <Text style={styles.historyDate}>{new Date(item.closedAt).toLocaleDateString()}</Text>
        </View>
      )}
    />
  );
};

// CHART TAB - Full screen TradingView chart with multiple chart tabs
const ChartTab = ({ route }) => {
  const ctx = React.useContext(TradingContext);
  const { colors, isDark } = useTheme();
  const toast = useToast();
  
  // Get initial symbol from route params or default to XAUUSD
  const initialSymbol = route?.params?.symbol || 'XAUUSD';
  const [chartTabs, setChartTabs] = useState([{ symbol: initialSymbol, id: 1 }]);
  const [activeTabId, setActiveTabId] = useState(1);
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  
  // Handle symbol change from navigation params
  React.useEffect(() => {
    if (route?.params?.symbol) {
      const symbol = route.params.symbol;
      // Check if symbol already exists in tabs
      const existingTab = chartTabs.find(t => t.symbol === symbol);
      if (existingTab) {
        // Switch to existing tab
        setActiveTabId(existingTab.id);
      } else {
        // Add new tab with this symbol
        const newId = Math.max(...chartTabs.map(t => t.id)) + 1;
        setChartTabs(prev => [...prev, { symbol, id: newId }]);
        setActiveTabId(newId);
      }
    }
  }, [route?.params?.symbol]);
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [orderSide, setOrderSide] = useState('BUY');
  const [volume, setVolume] = useState(0.01);
  const [volumeText, setVolumeText] = useState('0.01');
  const [isExecuting, setIsExecuting] = useState(false);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [showChartSlModal, setShowChartSlModal] = useState(false);
  const [chartSlValue, setChartSlValue] = useState('');
  const [pendingChartTradeSide, setPendingChartTradeSide] = useState(null);
  
  // Get leverage from account
  const getAccountLeverage = () => {
    if (ctx.isChallengeMode && ctx.selectedChallengeAccount) {
      return ctx.selectedChallengeAccount.leverage || '1:100';
    }
    return ctx.selectedAccount?.leverage || ctx.selectedAccount?.accountTypeId?.leverage || '1:100';
  };

  const activeTab = chartTabs.find(t => t.id === activeTabId) || chartTabs[0];
  const activeSymbol = activeTab?.symbol || 'XAUUSD';

  const addNewChartTab = (symbol) => {
    const newId = Math.max(...chartTabs.map(t => t.id)) + 1;
    setChartTabs([...chartTabs, { symbol, id: newId }]);
    setActiveTabId(newId);
    setShowSymbolPicker(false);
  };

  const removeChartTab = (id) => {
    if (chartTabs.length > 1) {
      const newTabs = chartTabs.filter(t => t.id !== id);
      setChartTabs(newTabs);
      if (activeTabId === id) {
        setActiveTabId(newTabs[0].id);
      }
    }
  };

  const currentInstrument = ctx.instruments.find(i => i.symbol === activeSymbol) || ctx.instruments[0];
  const currentPrice = ctx.livePrices[activeSymbol];
  const isForex = currentInstrument?.category === 'Forex';
  const decimals = isForex ? 5 : 2;

  const getSymbolForTradingView = (symbol) => {
    const symbolMap = {
      'EURUSD': 'OANDA:EURUSD', 'GBPUSD': 'OANDA:GBPUSD', 'USDJPY': 'OANDA:USDJPY',
      'USDCHF': 'OANDA:USDCHF', 'AUDUSD': 'OANDA:AUDUSD', 'NZDUSD': 'OANDA:NZDUSD',
      'USDCAD': 'OANDA:USDCAD', 'EURGBP': 'OANDA:EURGBP', 'EURJPY': 'OANDA:EURJPY',
      'GBPJPY': 'OANDA:GBPJPY', 'XAUUSD': 'OANDA:XAUUSD', 'XAGUSD': 'OANDA:XAGUSD',
      'BTCUSD': 'COINBASE:BTCUSD', 'ETHUSD': 'COINBASE:ETHUSD', 'LTCUSD': 'COINBASE:LTCUSD',
      'XRPUSD': 'BITSTAMP:XRPUSD', 'BNBUSD': 'BINANCE:BNBUSDT', 'SOLUSD': 'COINBASE:SOLUSD',
      'ADAUSD': 'COINBASE:ADAUSD', 'DOGEUSD': 'BINANCE:DOGEUSDT', 'DOTUSD': 'COINBASE:DOTUSD',
      'MATICUSD': 'COINBASE:MATICUSD', 'AVAXUSD': 'COINBASE:AVAXUSD', 'LINKUSD': 'COINBASE:LINKUSD',
    };
    return symbolMap[symbol] || `OANDA:${symbol}`;
  };

  const openOrderPanel = (side) => {
    setOrderSide(side);
    setShowOrderPanel(true);
  };

  // One-click trade execution - Fast execution
  const executeOneClickTrade = async (side, slPrice = null) => {
    if (isExecuting) return;
    
    // Check if challenge mode with SL mandatory
    if (ctx.isChallengeMode && ctx.selectedChallengeAccount?.challengeId?.rules?.stopLossMandatory && !slPrice) {
      setPendingChartTradeSide(side);
      setChartSlValue('');
      setShowChartSlModal(true);
      return;
    }
    
    if (!ctx.selectedAccount && !ctx.selectedChallengeAccount) {
      toast?.showToast('Please select a trading account first', 'error');
      return;
    }
    if (!currentPrice?.bid || !currentPrice?.ask) {
      toast?.showToast('No price data available', 'error');
      return;
    }
    
    setIsExecuting(true);
    try {
      const price = side === 'BUY' ? currentPrice.ask : currentPrice.bid;
      const segment = currentInstrument?.category || 'Forex';
      
      const orderData = {
        userId: ctx.user?._id,
        tradingAccountId: ctx.isChallengeMode && ctx.selectedChallengeAccount 
          ? ctx.selectedChallengeAccount._id 
          : ctx.selectedAccount._id,
        symbol: activeSymbol,
        segment: segment,
        side: side,
        quantity: volume,
        bid: currentPrice.bid,
        ask: currentPrice.ask,
        leverage: ctx.isChallengeMode ? ctx.selectedChallengeAccount?.leverage : ctx.selectedAccount?.leverage || '1:100',
        orderType: 'MARKET'
      };
      
      // Add SL if provided
      if (slPrice) {
        orderData.sl = parseFloat(slPrice);
      }
      
      const res = await fetch(`${API_URL}/trade/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      const data = await res.json();
      if (data.success) {
        const isChallengeMsg = data.isChallengeAccount ? ' (Challenge)' : '';
        toast?.showToast(`${side} ${volume} ${activeSymbol} @ ${price.toFixed(decimals)}${isChallengeMsg}`, 'success');
        ctx.fetchOpenTrades();
        ctx.fetchAccountSummary();
      } else {
        // Handle challenge-specific error codes
        if (data.code === 'DRAWDOWN_BREACH' || data.code === 'DAILY_DRAWDOWN_BREACH') {
          toast?.showToast(`⚠️ Challenge Failed: ${data.message}`, 'error');
        } else if (data.accountFailed) {
          toast?.showToast(`❌ Challenge Account Failed: ${data.failReason || data.message}`, 'error');
        } else {
          toast?.showToast(data.message || 'Failed to place order', 'error');
        }
      }
    } catch (e) {
      toast?.showToast('Network error', 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  const executeTrade = async () => {
    // Client-side validation for challenge account SL mandatory rule
    if (ctx.isChallengeMode && ctx.selectedChallengeAccount) {
      const rules = ctx.selectedChallengeAccount.challengeId?.rules;
      if (rules?.stopLossMandatory && !stopLoss) {
        Alert.alert('Stop Loss Required', 'Stop Loss is mandatory for this challenge. Please set SL before trading.');
        return;
      }
    }
    
    setIsExecuting(true);
    try {
      const price = orderSide === 'BUY' ? currentPrice?.ask : currentPrice?.bid;
      const segment = currentInstrument?.category || 'Forex';
      
      // Use challenge account ID if in challenge mode
      const tradingAccountId = ctx.isChallengeMode && ctx.selectedChallengeAccount 
        ? ctx.selectedChallengeAccount._id 
        : ctx.selectedAccount?._id;
      
      const orderData = {
        userId: ctx.user?._id,
        tradingAccountId: tradingAccountId,
        symbol: activeSymbol,
        segment: segment,
        side: orderSide,
        quantity: volume,
        bid: currentPrice?.bid,
        ask: currentPrice?.ask,
        leverage: ctx.selectedAccount?.leverage || '1:100',
        orderType: 'MARKET'
      };
      
      // Add SL/TP if set
      if (stopLoss) orderData.sl = parseFloat(stopLoss);
      if (takeProfit) orderData.tp = parseFloat(takeProfit);
      
      const res = await fetch(`${API_URL}/trade/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      const data = await res.json();
      if (data.success) {
        const isChallengeMsg = data.isChallengeAccount ? ' (Challenge)' : '';
        toast?.showToast(`${orderSide} order placed!${isChallengeMsg}`, 'success');
        setShowOrderPanel(false);
        setStopLoss('');
        setTakeProfit('');
        ctx.fetchOpenTrades();
        ctx.fetchAccountSummary();
      } else {
        // Handle challenge-specific error codes
        if (data.code === 'DRAWDOWN_BREACH' || data.code === 'DAILY_DRAWDOWN_BREACH') {
          toast?.showToast(`Challenge Failed: ${data.message}`, 'error');
        } else if (data.code === 'SL_MANDATORY') {
          toast?.showToast('⚠️ Stop Loss is mandatory for this challenge', 'warning');
        } else if (data.accountFailed) {
          toast?.showToast(`Challenge Account Failed: ${data.failReason || data.message}`, 'error');
        } else {
          toast?.showToast(data.message || 'Failed to place order', 'error');
        }
      }
    } catch (e) {
      toast?.showToast('Network error', 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  const chartTheme = isDark ? 'dark' : 'light';
  const chartBg = isDark ? '#0a0a0a' : '#ffffff';
  
  const chartHtml = `
    <!DOCTYPE html>
    <html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>*{margin:0;padding:0;box-sizing:border-box;}html,body{height:100%;width:100%;background:${chartBg};overflow:hidden;}</style></head>
    <body>
    <div class="tradingview-widget-container" style="height:100%;width:100%">
      <div id="tradingview_chart" style="height:100%;width:100%"></div>
    </div>
    <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
    <script type="text/javascript">
    new TradingView.widget({
      "autosize": true,
      "symbol": "${getSymbolForTradingView(activeSymbol)}",
      "interval": "5",
      "timezone": "Etc/UTC",
      "theme": "${chartTheme}",
      "style": "1",
      "locale": "en",
      "toolbar_bg": "${chartBg}",
      "enable_publishing": false,
      "hide_top_toolbar": false,
      "hide_legend": false,
      "hide_side_toolbar": false,
      "save_image": false,
      "container_id": "tradingview_chart",
      "backgroundColor": "${chartBg}",
      "withdateranges": true,
      "allow_symbol_change": false,
      "details": true,
      "hotlist": false,
      "calendar": false,
      "show_popup_button": true,
      "popup_width": "1000",
      "popup_height": "650",
      "studies": [],
      "studies_overrides": {},
      "overrides": {
        "mainSeriesProperties.showPriceLine": true,
        "mainSeriesProperties.highLowAvgPrice.highLowPriceLinesVisible": true,
        "scalesProperties.showSeriesLastValue": true,
        "scalesProperties.showStudyLastValue": true,
        "paneProperties.legendProperties.showLegend": true,
        "paneProperties.legendProperties.showSeriesTitle": true,
        "paneProperties.legendProperties.showSeriesOHLC": true,
        "paneProperties.legendProperties.showBarChange": true
      }
    });
    </script></body></html>
  `;

  return (
    <View style={[styles.chartContainer, { backgroundColor: colors.bgPrimary }]}>
      {/* Top Bar - Multiple Chart Tabs */}
      <View style={[styles.chartTabsBar, { backgroundColor: colors.bgSecondary, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartTabsScroll}>
          {chartTabs.map(tab => (
            <TouchableOpacity 
              key={tab.id}
              style={[styles.chartTab, { backgroundColor: colors.bgCard }, activeTabId === tab.id && styles.chartTabActive]}
              onPress={() => setActiveTabId(tab.id)}
              onLongPress={() => removeChartTab(tab.id)}
            >
              <Text style={[styles.chartTabText, { color: colors.textMuted }, activeTabId === tab.id && styles.chartTabTextActive]}>
                {tab.symbol}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.addChartBtn} onPress={() => setShowSymbolPicker(true)}>
          <Ionicons name="add" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Quick Trade Bar - Screenshot Style: SELL price | - lot + | BUY price */}
      <View style={[styles.quickTradeBarTop, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
        {/* SELL Button with Price */}
        <TouchableOpacity 
          style={[styles.sellPriceBtn, isExecuting && styles.btnDisabled]}
          onPress={() => executeOneClickTrade('SELL')}
          disabled={isExecuting}
        >
          <Text style={styles.sellLabel}>sell</Text>
          <Text style={styles.sellPrice}>{currentPrice?.bid?.toFixed(decimals) || '-'}</Text>
        </TouchableOpacity>

        {/* Lot Size with +/- */}
        <View style={[styles.lotControlCenter, { backgroundColor: colors.bgSecondary }]}>
          <TouchableOpacity style={styles.lotMinusBtn} onPress={() => { const v = Math.max(0.01, volume - 0.01); setVolume(v); setVolumeText(v.toFixed(2)); }}>
            <Text style={styles.lotControlText}>−</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.lotCenterInput, { color: colors.textPrimary }]}
            value={volumeText}
            onChangeText={(text) => {
              if (text === '' || /^\d*\.?\d*$/.test(text)) {
                setVolumeText(text);
                // Update volume state in real-time for valid numbers
                const val = parseFloat(text);
                if (!isNaN(val) && val > 0) {
                  setVolume(val);
                }
              }
            }}
            onBlur={() => {
              const val = parseFloat(volumeText);
              if (isNaN(val) || val <= 0) {
                setVolumeText('0.01');
                setVolume(0.01);
              } else {
                setVolume(val);
                setVolumeText(val.toFixed(2));
              }
            }}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
          <TouchableOpacity style={styles.lotPlusBtn} onPress={() => { const v = volume + 0.01; setVolume(v); setVolumeText(v.toFixed(2)); }}>
            <Text style={styles.lotControlText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* BUY Button with Price */}
        <TouchableOpacity 
          style={[styles.buyPriceBtn, isExecuting && styles.btnDisabled]}
          onPress={() => executeOneClickTrade('BUY')}
          disabled={isExecuting}
        >
          <Text style={styles.buyLabel}>buy</Text>
          <Text style={styles.buyPrice}>{currentPrice?.ask?.toFixed(decimals) || '-'}</Text>
        </TouchableOpacity>
      </View>

      {/* Full Screen Chart */}
      <View style={styles.chartWrapper}>
        <WebView
          key={`${activeSymbol}-${isDark}`}
          source={{ html: chartHtml }}
          style={{ flex: 1, backgroundColor: chartBg }}
          javaScriptEnabled={true}
          scrollEnabled={false}
        />
      </View>

      {/* Order Panel Slide Up */}
      <Modal visible={showOrderPanel} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.orderSlidePanel}>
            <View style={styles.orderPanelHandle} />
            <View style={styles.orderPanelHeader}>
              <Text style={styles.orderPanelTitle}>{activeSymbol}</Text>
              <TouchableOpacity onPress={() => setShowOrderPanel(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Side Toggle */}
            <View style={styles.sideToggle}>
              <TouchableOpacity 
                style={[styles.sideBtn, orderSide === 'SELL' && styles.sideBtnSell]}
                onPress={() => setOrderSide('SELL')}
              >
                <Text style={styles.sideBtnText}>SELL</Text>
                <Text style={styles.sideBtnPrice}>{currentPrice?.bid?.toFixed(decimals) || '-'}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sideBtn, orderSide === 'BUY' && styles.sideBtnBuy]}
                onPress={() => setOrderSide('BUY')}
              >
                <Text style={styles.sideBtnText}>BUY</Text>
                <Text style={styles.sideBtnPrice}>{currentPrice?.ask?.toFixed(decimals) || '-'}</Text>
              </TouchableOpacity>
            </View>

            {/* Volume */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Volume (Lots)</Text>
              <View style={styles.volumeInput}>
                <TouchableOpacity style={styles.volumeBtn} onPress={() => setVolume(Math.max(0.01, volume - 0.01))}>
                  <Ionicons name="remove" size={20} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.volumeValue}>{volume.toFixed(2)}</Text>
                <TouchableOpacity style={styles.volumeBtn} onPress={() => setVolume(volume + 0.01)}>
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* SL/TP for Challenge Accounts */}
            {ctx.isChallengeMode && ctx.selectedChallengeAccount && (
              <View style={styles.slTpRow}>
                <View style={styles.slTpInputGroup}>
                  <Text style={[styles.inputLabel, ctx.selectedChallengeAccount.challengeId?.rules?.stopLossMandatory && { color: '#f59e0b' }]}>
                    Stop Loss {ctx.selectedChallengeAccount.challengeId?.rules?.stopLossMandatory ? '*' : ''}
                  </Text>
                  <TextInput
                    style={[styles.slTpInput, { backgroundColor: '#1a1a1a', color: '#fff', borderColor: '#333' }]}
                    value={stopLoss}
                    onChangeText={(text) => setStopLoss(text.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    placeholderTextColor="#666"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={styles.slTpInputGroup}>
                  <Text style={styles.inputLabel}>Take Profit</Text>
                  <TextInput
                    style={[styles.slTpInput, { backgroundColor: '#1a1a1a', color: '#fff', borderColor: '#333' }]}
                    value={takeProfit}
                    onChangeText={(text) => setTakeProfit(text.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    placeholderTextColor="#666"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>
            )}

            {/* Execute Button */}
            <TouchableOpacity 
              style={[styles.executeBtn, { backgroundColor: orderSide === 'BUY' ? '#22c55e' : '#ef4444' }, isExecuting && { opacity: 0.6 }]}
              onPress={executeTrade}
              disabled={isExecuting}
            >
              {isExecuting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.executeBtnText}>
                  {orderSide} {volume.toFixed(2)} {activeSymbol}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Symbol Picker Modal - Add new chart */}
      <Modal visible={showSymbolPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.symbolPickerModal}>
            <View style={styles.symbolPickerHeader}>
              <Text style={styles.symbolPickerTitle}>Add Chart</Text>
              <TouchableOpacity onPress={() => setShowSymbolPicker(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {ctx.instruments.map(inst => (
                <TouchableOpacity
                  key={inst.symbol}
                  style={[styles.symbolPickerItem, chartTabs.some(t => t.symbol === inst.symbol) && styles.symbolPickerItemActive]}
                  onPress={() => addNewChartTab(inst.symbol)}
                >
                  <View>
                    <Text style={styles.symbolPickerSymbol}>{inst.symbol}</Text>
                    <Text style={styles.symbolPickerName}>{inst.name}</Text>
                  </View>
                  {chartTabs.some(t => t.symbol === inst.symbol) && <Ionicons name="checkmark" size={20} color="#22c55e" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Chart SL Modal for Challenge Accounts */}
      <Modal visible={showChartSlModal} animationType="fade" transparent onRequestClose={() => setShowChartSlModal(false)}>
        <View style={styles.quickSlModalOverlay}>
          <View style={[styles.quickSlModalContent, { backgroundColor: colors.bgCard }]}>
            <View style={styles.quickSlModalHeader}>
              <Ionicons name="warning" size={24} color="#f59e0b" />
              <Text style={[styles.quickSlModalTitle, { color: colors.textPrimary }]}>Stop Loss Required</Text>
            </View>
            <Text style={[styles.quickSlModalSubtitle, { color: colors.textMuted }]}>
              Stop Loss is mandatory for challenge accounts. Please set a stop loss price before placing your trade.
            </Text>
            
            <View style={styles.quickSlInputContainer}>
              <Text style={[styles.quickSlInputLabel, { color: colors.textMuted }]}>Stop Loss Price</Text>
              <TextInput
                style={[styles.quickSlInput, { backgroundColor: colors.bgSecondary, color: colors.textPrimary, borderColor: colors.border }]}
                value={chartSlValue}
                onChangeText={(text) => setChartSlValue(text.replace(/[^0-9.]/g, ''))}
                placeholder={`e.g. ${pendingChartTradeSide === 'BUY' 
                  ? (currentPrice?.bid * 0.99)?.toFixed(decimals) 
                  : (currentPrice?.ask * 1.01)?.toFixed(decimals)}`}
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
              />
              <Text style={[styles.quickSlHint, { color: colors.textMuted }]}>
                Current {pendingChartTradeSide === 'BUY' ? 'Bid' : 'Ask'}: {pendingChartTradeSide === 'BUY' 
                  ? currentPrice?.bid?.toFixed(decimals) 
                  : currentPrice?.ask?.toFixed(decimals)}
              </Text>
            </View>

            <View style={styles.quickSlModalButtons}>
              <TouchableOpacity 
                style={[styles.quickSlCancelBtn, { backgroundColor: colors.bgSecondary }]}
                onPress={() => {
                  setShowChartSlModal(false);
                  setPendingChartTradeSide(null);
                  setChartSlValue('');
                }}
              >
                <Text style={[styles.quickSlCancelBtnText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.quickSlConfirmBtn, { backgroundColor: pendingChartTradeSide === 'BUY' ? '#22c55e' : '#ef4444' }]}
                onPress={() => {
                  if (!chartSlValue || isNaN(parseFloat(chartSlValue))) {
                    toast?.showToast('Please enter a valid stop loss price', 'warning');
                    return;
                  }
                  setShowChartSlModal(false);
                  // Execute trade with SL
                  executeOneClickTrade(pendingChartTradeSide, chartSlValue);
                  setPendingChartTradeSide(null);
                  setChartSlValue('');
                }}
              >
                <Text style={styles.quickSlConfirmBtnText}>
                  {pendingChartTradeSide === 'BUY' ? 'BUY' : 'SELL'} with SL
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// MORE TAB - Matching screenshot exactly
const MoreTab = ({ navigation }) => {
  const ctx = React.useContext(TradingContext);
  const { colors, isDark, toggleTheme } = useTheme();
  const parentNav = navigation.getParent();

  const menuItems = [
    { icon: 'book-outline', label: 'Orders', screen: 'OrderBook', isTab: false, color: colors.primary },
    { icon: 'wallet-outline', label: 'Wallet', screen: 'Wallet', isTab: false, color: colors.primary },
    { icon: 'copy-outline', label: 'Copy Trade', screen: 'CopyTrade', isTab: false, color: colors.primary },
    { icon: 'trophy-outline', label: 'Challenge Rules', screen: 'ChallengeRules', isTab: false, color: '#f59e0b' },
    { icon: 'people-outline', label: 'IB Program', screen: 'IB', isTab: false, color: colors.primary },
    { icon: 'person-outline', label: 'Profile', screen: 'Profile', isTab: false, color: colors.primary },
    { icon: 'help-circle-outline', label: 'Support', screen: 'Support', isTab: false, color: colors.primary },
    { icon: 'document-text-outline', label: 'Instructions', screen: 'Instructions', isTab: false, color: colors.primary },
  ];

  const handleNavigate = (screen, isTab) => {
    if (isTab) {
      navigation.navigate(screen);
    } else if (parentNav) {
      parentNav.navigate(screen);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Header */}
      <View style={[styles.moreMenuHeader, { backgroundColor: colors.bgPrimary }]}>
        <Text style={[styles.moreMenuTitle, { color: colors.textPrimary }]}>More</Text>
      </View>

      {/* Menu Items */}
      <ScrollView style={styles.moreMenuList}>
        {menuItems.map((item, index) => (
          <TouchableOpacity key={index} style={[styles.moreMenuItem, { borderBottomColor: colors.border }]} onPress={() => handleNavigate(item.screen, item.isTab)}>
            <View style={[styles.moreMenuIcon, { backgroundColor: `${item.color}20` }]}>
              <Ionicons name={item.icon} size={20} color={item.color} />
            </View>
            <Text style={[styles.moreMenuItemText, { color: colors.textPrimary }]}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ))}

        {/* Dark/Light Mode Toggle */}
        <View style={[styles.themeToggleItem, { borderBottomColor: colors.border }]}>
          <View style={[styles.moreMenuIcon, { backgroundColor: `${colors.primary}20` }]}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={colors.primary} />
          </View>
          <Text style={[styles.moreMenuItemText, { color: colors.textPrimary }]}>Dark Mode</Text>
          <TouchableOpacity 
            style={[styles.themeToggle, { backgroundColor: isDark ? colors.primary : colors.border }, isDark && styles.themeToggleActive]}
            onPress={toggleTheme}
          >
            <View style={[styles.themeToggleThumb, isDark && styles.themeToggleThumbActive]} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={[styles.moreMenuItem, { borderBottomColor: colors.border }]} onPress={ctx.logout}>
          <View style={[styles.moreMenuIcon, { backgroundColor: `${colors.primary}20` }]}>
            <Ionicons name="log-out-outline" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.moreMenuItemText, { color: colors.primary }]}>Log Out</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

// Tab Navigator with theme support
const ThemedTabNavigator = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const ctx = React.useContext(TradingContext);
  
  // Calculate bottom padding for navigation bar
  const bottomPadding = Math.max(insets.bottom, 10);
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { 
          backgroundColor: colors.tabBarBg, 
          borderTopColor: colors.border, 
          height: 60 + bottomPadding, 
          paddingBottom: bottomPadding 
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Markets') iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          else if (route.name === 'Chart') iconName = focused ? 'analytics' : 'analytics-outline';
          else if (route.name === 'Trade') iconName = focused ? 'trending-up' : 'trending-up-outline';
          else if (route.name === 'More') iconName = focused ? 'menu' : 'menu-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
      screenListeners={{
        tabPress: (e) => {
          // Track current tab for notifications
          ctx.setCurrentMainTab(e.target.split('-')[0]);
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeTab} />
      <Tab.Screen name="Markets" component={QuotesTab} />
      <Tab.Screen name="Chart" component={ChartTab} />
      <Tab.Screen name="Trade" component={TradeTab} />
      <Tab.Screen name="More" component={MoreTab} />
    </Tab.Navigator>
  );
};

// MAIN SCREEN
const MainTradingScreen = ({ navigation, route }) => {
  return (
    <ToastProvider>
      <TradingProvider navigation={navigation} route={route}>
        <ThemedTabNavigator />
      </TradingProvider>
    </ToastProvider>
  );
};

// Gold color constant
const GOLD = '#22c55e';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  tabBar: { backgroundColor: '#0a0a0a', borderTopColor: '#0a0a0a', height: 60, paddingBottom: 8 },
  
  // Banner Slider
  bannerContainer: { marginHorizontal: 16, marginBottom: 16, borderRadius: 12, overflow: 'hidden' },
  bannerSlide: { width: Dimensions.get('window').width - 32, height: 140 },
  bannerImage: { width: '100%', height: '100%', borderRadius: 12 },
  bannerDots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', position: 'absolute', bottom: 10, left: 0, right: 0, gap: 6 },
  bannerDot: { width: 8, height: 8, borderRadius: 4 },

  // Home
  homeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50 },
  greeting: { color: '#666', fontSize: 14 },
  userName: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  notificationBtn: { padding: 10, backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#222', position: 'relative' },
  notificationBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#ef4444', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  notificationBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  
  accountCard: { margin: 16, padding: 16, backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#1e1e1e' },
  accountCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  accountIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#22c55e20', justifyContent: 'center', alignItems: 'center' },
  accountInfo: { flex: 1, marginLeft: 12 },
  accountId: { color: '#fff', fontSize: 16, fontWeight: '600' },
  accountType: { color: '#666', fontSize: 12, marginTop: 2 },
  challengeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  challengeBadgeText: { fontSize: 10, fontWeight: '700' },
  challengeInfoBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  challengeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  challengeInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  challengeInfoRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  challengeInfoName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 120,
  },
  challengeInfoPhase: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '600',
  },
  challengeInfoLabel: {
    color: '#888',
    fontSize: 11,
  },
  challengeInfoValue: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  failedReasonContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#ef444420', 
    padding: 12, 
    borderRadius: 10, 
    marginBottom: 12,
    gap: 8
  },
  failedReasonText: { 
    color: '#ef4444', 
    fontSize: 13, 
    flex: 1,
    fontWeight: '500'
  },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  balanceLabel: { color: '#666', fontSize: 11, marginBottom: 2 },
  balanceValue: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  equityValue: { fontSize: 20, fontWeight: 'bold' },
  pnlRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1e1e1e' },
  pnlValue: { fontSize: 16, fontWeight: '600' },
  freeMarginValue: { fontSize: 16, fontWeight: '600' },
  cardActionButtons: { flexDirection: 'row', gap: 8, marginTop: 4 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1e1e1e' },
  statItem: { flex: 1 },
  statLabel: { color: '#666', fontSize: 12, marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  // Deposit/Withdraw Buttons
  actionButtons: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12 },
  depositBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: '#22c55e', borderRadius: 12 },
  depositBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  withdrawBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: '#0f0f0f', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  withdrawBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  
  // Quick Actions Grid - 8 stylish buttons
  quickActionsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    paddingHorizontal: 16, 
    paddingVertical: 12,
    justifyContent: 'space-between'
  },
  quickActionBtn: { 
    width: '23%', 
    alignItems: 'center', 
    paddingVertical: 14,
    marginBottom: 12
  },
  quickActionBtnLabel: { 
    color: '#a0a0a0', 
    fontSize: 11, 
    fontWeight: '500', 
    marginTop: 6 
  },
  // Legacy styles (kept for compatibility)
  quickActionsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  quickActionCard: { flex: 1, alignItems: 'center', paddingVertical: 16, backgroundColor: '#000000', borderRadius: 12, borderWidth: 1, borderColor: '#1a1a1a' },
  quickActionIconBg: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickActionLabel: { color: '#fff', fontSize: 11, fontWeight: '500' },
  
  // Section Header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  seeAllText: { color: '#22c55e', fontSize: 13, fontWeight: '500' },
  
  // Copy Trade Masters Section
  mastersSection: { marginHorizontal: 16, marginTop: 16 },
  mastersScroll: { marginLeft: -4 },
  masterCard: { 
    width: 100, 
    backgroundColor: '#0f0f0f', 
    borderRadius: 12, 
    padding: 12, 
    marginLeft: 8, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a'
  },
  masterCardHeader: { position: 'relative', marginBottom: 8 },
  masterAvatar: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: '#22c55e30', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  masterAvatarText: { color: '#22c55e', fontSize: 18, fontWeight: 'bold' },
  followingBadgeSmall: { 
    position: 'absolute', 
    bottom: -2, 
    right: -2, 
    width: 18, 
    height: 18, 
    borderRadius: 9, 
    backgroundColor: '#22c55e20', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#111'
  },
  masterName: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  masterProfit: { color: '#22c55e', fontSize: 14, fontWeight: 'bold', marginTop: 4 },
  masterFollowers: { color: '#666', fontSize: 10, marginTop: 2 },
  
  // Market Data Section
  marketDataSection: { marginHorizontal: 16, marginTop: 20 },
  marketTabs: { flexDirection: 'row', backgroundColor: '#0f0f0f', borderRadius: 10, padding: 4, marginBottom: 12 },
  marketTab: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 4, 
    paddingVertical: 8, 
    borderRadius: 8 
  },
  marketTabActive: { backgroundColor: '#22c55e' },
  marketTabText: { color: '#888', fontSize: 12, fontWeight: '600' },
  marketTabTextActive: { color: '#fff' },
  marketList: {},
  marketItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#1a1a1a' 
  },
  marketItemLeft: {},
  marketSymbol: { color: '#fff', fontSize: 14, fontWeight: '600' },
  marketName: { color: '#666', fontSize: 11, marginTop: 2, maxWidth: 150 },
  marketItemRight: { alignItems: 'flex-end' },
  marketPrice: { color: '#fff', fontSize: 14, fontWeight: '600' },
  changeBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 2, 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4, 
    marginTop: 4 
  },
  changeText: { fontSize: 11, fontWeight: '600' },
  
  // Empty Watchlist Home
  emptyWatchlistHome: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyWatchlistHomeText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 10,
  },
  emptyWatchlistHomeHint: {
    color: '#555',
    fontSize: 12,
    marginTop: 4,
  },
  
  // Master Detail Modal
  masterDetailModal: { 
    backgroundColor: '#111', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    padding: 20, 
    paddingBottom: 40,
    maxHeight: '80%'
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  masterModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  masterModalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  masterProfileCard: { alignItems: 'center', marginBottom: 20 },
  masterProfileAvatar: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: '#22c55e30', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 12
  },
  masterProfileAvatarText: { color: '#22c55e', fontSize: 32, fontWeight: 'bold' },
  masterProfileName: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  masterProfileBio: { color: '#888', fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
  followingBadgeLarge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: '#22c55e20', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20, 
    marginTop: 12 
  },
  followingBadgeLargeText: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  masterStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  masterStatBox: { 
    flex: 1, 
    minWidth: '45%', 
    backgroundColor: '#0a0a0a', 
    borderRadius: 12, 
    padding: 14, 
    alignItems: 'center' 
  },
  masterStatLabel: { color: '#666', fontSize: 11 },
  masterStatValue: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  followMasterBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
    backgroundColor: '#22c55e', 
    paddingVertical: 14, 
    borderRadius: 12 
  },
  followMasterBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  alreadyFollowingBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
    backgroundColor: '#22c55e20', 
    paddingVertical: 14, 
    borderRadius: 12 
  },
  alreadyFollowingText: { color: '#22c55e', fontSize: 14, fontWeight: '600' },
  viewFullProfileBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6, 
    marginTop: 16, 
    paddingVertical: 12 
  },
  viewFullProfileText: { color: '#22c55e', fontSize: 14, fontWeight: '600' },
  
  // MarketWatch News Section
  marketWatchSection: { marginHorizontal: 16, marginTop: 16 },
  marketWatchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  marketWatchTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  marketWatchTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ef444420', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444', marginRight: 4 },
  liveText: { color: '#ef4444', fontSize: 10, fontWeight: '700' },
  newsCardsContainer: { paddingRight: 16, gap: 12 },
  newsCardsVertical: { gap: 16 },
  newsCard: { width: 280, backgroundColor: '#111', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
  newsCardVertical: { flexDirection: 'row', backgroundColor: '#111', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#222', marginBottom: 12 },
  newsCardFull: { width: '100%', backgroundColor: '#111', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
  newsCardImage: { width: '100%', height: 180, backgroundColor: '#1a1a1a' },
  newsCardImageVertical: { width: 140, height: 140, backgroundColor: '#1a1a1a' },
  newsCardImageFull: { width: '100%', height: 200, backgroundColor: '#1a1a1a' },
  newsCardContent: { padding: 14 },
  newsCardContentVertical: { flex: 1, padding: 14, justifyContent: 'space-between' },
  newsCardContentFull: { padding: 14 },
  newsCardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  newsCategoryBadge: { backgroundColor: '#22c55e20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  newsCategoryText: { color: '#22c55e', fontSize: 11, fontWeight: '600' },
  newsTime: { color: '#666', fontSize: 11 },
  newsCardTitle: { color: '#fff', fontSize: 14, fontWeight: '600', lineHeight: 20, marginBottom: 6 },
  newsCardDesc: { color: '#888', fontSize: 12, lineHeight: 17, marginBottom: 10 },
  newsCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  newsSource: { color: '#888', fontSize: 11, flex: 1 },
  newsLoadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 30, gap: 10 },
  newsLoadingText: { color: '#666', fontSize: 14 },
  marketWatchNewsContainer: { height: 450, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  marketWatchWebView: { flex: 1, backgroundColor: 'transparent' },
  newsListContainer: { gap: 12 },
  newsCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  newsTimeText: { color: '#666', fontSize: 11 },
  newsCardSummary: { color: '#888', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  newsSourceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  newsSourceText: { color: '#888', fontSize: 12 },
  
  // Positions Card
  positionsCard: { margin: 16, padding: 16, backgroundColor: '#000000', borderRadius: 16, borderWidth: 1, borderColor: '#1a1a1a' },
  positionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  positionsTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  positionsCount: { color: '#22c55e', fontSize: 14 },
  noPositionsText: { color: '#666', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  positionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#000000', borderRadius: 12, marginBottom: 8 },
  positionSide: { fontSize: 12, marginTop: 2 },
  positionPnlValue: { fontSize: 16, fontWeight: '600' },
  viewAllText: { color: '#22c55e', fontSize: 14, textAlign: 'center', paddingTop: 8 },
  
  // News Section (Home Tab)
  newsSection: { margin: 16, marginTop: 8 },
  newsSectionTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  newsTabs: { flexDirection: 'row', backgroundColor: '#000000', borderRadius: 12, padding: 4, marginBottom: 12, borderWidth: 1, borderColor: '#1a1a1a' },
  newsTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  newsTabActive: { backgroundColor: '#000000' },
  newsTabText: { color: '#666', fontSize: 12, fontWeight: '500' },
  newsTabTextActive: { color: '#22c55e' },
  newsContent: {},
  newsItem: { backgroundColor: '#000000', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#1a1a1a' },
  newsCategory: { backgroundColor: '#22c55e20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 8 },
  newsCategoryText: { color: '#22c55e', fontSize: 11, fontWeight: '600' },
  newsTitle: { color: '#fff', fontSize: 14, fontWeight: '500', lineHeight: 20, marginBottom: 8 },
  newsMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  newsSource: { color: '#888', fontSize: 12 },
  newsTime: { color: '#666', fontSize: 12 },
  calendarContent: { backgroundColor: '#000000', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#1a1a1a' },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#000000', borderBottomWidth: 1, borderBottomColor: '#000000' },
  calendarHeaderText: { color: '#666', fontSize: 11, fontWeight: '600', width: 50, textAlign: 'center' },
  calendarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#000000' },
  calendarTime: { color: '#fff', fontSize: 12, fontWeight: '500', width: 50, textAlign: 'center' },
  currencyBadge: { backgroundColor: '#22c55e20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, width: 50, alignItems: 'center' },
  currencyText: { color: '#22c55e', fontSize: 11, fontWeight: '600' },
  eventName: { color: '#fff', fontSize: 13, fontWeight: '500' },
  eventForecast: { color: '#666', fontSize: 10, marginTop: 2 },
  impactDot: { width: 10, height: 10, borderRadius: 5 },
  
  // TradingView Widget Container
  tradingViewContainer: { height: 700, backgroundColor: '#000000', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#1a1a1a' },
  tradingViewWebView: { flex: 1, backgroundColor: '#000000' },
  webViewLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },
  webViewLoadingText: { color: '#666', fontSize: 12, marginTop: 8 },
  
  section: { padding: 16 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#666', marginTop: 12 },
  
  tradeItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#000000', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#1a1a1a' },
  tradeLeft: {},
  tradeSymbol: { color: '#fff', fontSize: 16, fontWeight: '600' },
  tradeSide: { fontSize: 12, marginTop: 4 },
  tradePnl: { fontSize: 16, fontWeight: '600' },
  
  // Quotes/Market - Venta Black Style (Responsive)
  searchContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginHorizontal: 12, 
    marginTop: 50, 
    marginBottom: 10, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    backgroundColor: '#000000', 
    borderRadius: 10,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  searchInput: { flex: 1, marginLeft: 8, color: '#fff', fontSize: 14, paddingVertical: 0 },
  
  // Market Section - New Styles
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 50,
    marginBottom: 4,
  },
  brandBarText: { fontSize: 18, fontWeight: '700' },
  marketSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 14, 
    paddingVertical: 12, 
    backgroundColor: '#000000', 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  marketTabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#000000',
    borderRadius: 12,
    padding: 4,
  },
  marketTabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  marketTabBtnActive: {
    backgroundColor: '#22c55e',
  },
  marketTabText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  marketTabTextActive: {
    color: '#000',
  },
  marketContent: {
    flex: 1,
    paddingHorizontal: 12,
  },
  emptyWatchlist: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyWatchlistTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyWatchlistText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  segmentContainer: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  segmentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  segmentTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  segmentCount: {
    backgroundColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  segmentCountText: {
    color: '#666',
    fontSize: 12,
  },
  segmentInstruments: {
    borderTopWidth: 1,
  },
  categoriesContainer: { paddingHorizontal: 10, marginBottom: 8, height: 40 },
  categoryBtn: { 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    marginRight: 6, 
    borderRadius: 16, 
    backgroundColor: '#000000',
    height: 34,
    justifyContent: 'center',
    minWidth: 50,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  categoryBtnActive: { backgroundColor: '#22c55e' },
  categoryText: { color: '#666', fontSize: 12, fontWeight: '500' },
  categoryTextActive: { color: '#000', fontWeight: '600' },
  
  instrumentItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 12, 
    paddingVertical: 12, 
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  starBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  instrumentInfo: { flex: 1, marginLeft: 8 },
  instrumentSymbol: { color: '#fff', fontSize: 14, fontWeight: '600' },
  instrumentName: { color: '#666', fontSize: 10, marginTop: 2 },
  instrumentPriceCol: { width: 60, alignItems: 'center' },
  bidPrice: { color: '#22c55e', fontSize: 13, fontWeight: '500' },
  askPrice: { color: '#ef4444', fontSize: 13, fontWeight: '500' },
  priceLabel: { color: '#666', fontSize: 9, marginTop: 1 },
  spreadBadgeCol: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4, marginHorizontal: 4, minWidth: 32, alignItems: 'center', borderWidth: 1 },
  spreadBadgeText: { color: '#22c55e', fontSize: 11, fontWeight: '600' },
  chartIconBtn: { 
    width: 32, 
    height: 32, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderRadius: 8,
    borderWidth: 1,
  },
  
  // Chart Trading Panel - One Click Buy/Sell
  chartTradingPanel: { backgroundColor: '#000000', paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 16 },
  chartVolRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  chartVolMinusBtn: { width: 36, height: 36, backgroundColor: '#000000', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  chartVolPlusBtn: { width: 36, height: 36, backgroundColor: '#000000', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  chartVolDisplay: { alignItems: 'center', marginHorizontal: 16, minWidth: 80 },
  chartVolLabel: { color: '#666', fontSize: 10 },
  chartVolValue: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  chartTradeButtons: { flexDirection: 'row', gap: 10 },
  chartSellButton: { flex: 1, backgroundColor: '#22c55e', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  chartBuyButton: { flex: 1, backgroundColor: '#22c55e', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  chartSellLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
  chartBuyLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
  chartSellPrice: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  chartBuyPrice: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  chartSpreadText: { color: '#666', fontSize: 11, textAlign: 'center', marginTop: 8 },
  
  // Order Panel - Slide from Bottom (Fixed - positioned at bottom)
  orderModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  orderPanelBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  orderPanelScroll: { maxHeight: height * 0.85 },
  orderPanelContainer: { backgroundColor: '#000000', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },
  orderPanelHandle: { width: 40, height: 4, backgroundColor: '#000000', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 12 },
  orderPanelHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  orderPanelSymbol: { color: '#fff', fontSize: 16, fontWeight: '600' },
  orderPanelName: { color: '#666', fontSize: 12, marginTop: 2 },
  orderCloseBtn: { padding: 6 },
  leverageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#000000', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  leverageLabel: { color: '#888', fontSize: 12 },
  leverageValue: { color: '#22c55e', fontSize: 14, fontWeight: 'bold' },
  quickTradeRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  quickSellBtn: { flex: 1, backgroundColor: '#ef4444', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  quickBuyBtn: { flex: 1, backgroundColor: '#22c55e', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  quickBtnLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
  quickBtnPrice: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  btnDisabled: { opacity: 0.5 },
  spreadInfoRow: { alignItems: 'center', marginBottom: 10 },
  spreadInfoText: { color: '#666', fontSize: 11 },
  slMandatoryBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 10, gap: 8 },
  slMandatoryText: { color: '#f59e0b', fontSize: 12, flex: 1 },
  orderTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  orderTypeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  orderTypeBtnActive: { backgroundColor: '#22c55e' },
  orderTypeBtnText: { fontSize: 13, fontWeight: '600' },
  orderTypeBtnTextActive: { color: '#fff' },
  pendingTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  pendingTypeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  pendingTypeBtnActive: { borderColor: '#22c55e' },
  pendingTypeText: { color: '#666', fontSize: 12 },
  pendingTypeTextActive: { color: '#22c55e' },
  inputSection: { marginBottom: 10 },
  inputLabel: { color: '#888', fontSize: 11, marginBottom: 4 },
  priceInput: { backgroundColor: '#000000', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 15 },
  volumeControlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  volumeControlBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#22c55e', borderRadius: 8 },
  volumeInputField: { flex: 1, backgroundColor: '#000000', borderRadius: 8, paddingVertical: 10, textAlign: 'center', color: '#fff', fontSize: 15 },
  slTpRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  slTpCol: { flex: 1 },
  slTpInputOrder: { backgroundColor: '#000000', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 14 },
  finalTradeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  finalSellBtn: { flex: 1, backgroundColor: '#ef4444', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  finalBuyBtn: { flex: 1, backgroundColor: '#22c55e', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  finalBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  spreadBadge: { backgroundColor: '#000000', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginHorizontal: 8, borderWidth: 1, borderColor: '#1a1a1a' },
  spreadText: { color: '#22c55e', fontSize: 10 },
  
  // Trade
  priceBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#000000' },
  currentSymbol: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  currentName: { color: '#666', fontSize: 12 },
  priceDisplay: { flexDirection: 'row', gap: 16 },
  bidPriceMain: { color: '#22c55e', fontSize: 16, fontWeight: '600' },
  askPriceMain: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
  
  // Account Summary (Trade Tab)
  accountSummaryList: { backgroundColor: '#000000', borderBottomWidth: 1, borderBottomColor: '#000000', paddingTop: 50 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#000000' },
  summaryLabel: { color: '#666', fontSize: 14 },
  summaryValue: { color: '#fff', fontSize: 14 },
  pendingStatus: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  historySide: { fontSize: 12, marginLeft: 8 },
  
  tradeTabs: { flexDirection: 'row', backgroundColor: '#000000', borderBottomWidth: 1, borderBottomColor: '#000000' },
  tradeTabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tradeTabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#22c55e' },
  tradeTabText: { color: '#666', fontSize: 14 },
  tradeTabTextActive: { color: '#22c55e', fontWeight: '600' },
  
  tradesList: { flex: 1 },
  positionItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#000000' },
  positionRow: { flexDirection: 'row', alignItems: 'center' },
  positionInfo: { flex: 1 },
  positionSymbolRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  positionSymbol: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sideBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  sideText: { fontSize: 10, fontWeight: '600' },
  positionDetail: { color: '#666', fontSize: 12, marginTop: 4 },
  slTpText: { color: '#888', fontSize: 11, marginTop: 2 },
  positionActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 8 },
  editBtn: { padding: 10, backgroundColor: '#22c55e20', borderRadius: 10 },
  closeTradeBtn: { padding: 10, backgroundColor: '#22c55e20', borderRadius: 10 },
  positionPnlCol: { alignItems: 'flex-end' },
  positionPnl: { fontSize: 15, fontWeight: '600' },
  currentPriceText: { color: '#666', fontSize: 12, marginTop: 2 },
  closeBtn: { backgroundColor: '#22c55e20', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
  closeBtnText: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  
  // SL/TP Modal
  slTpModalOverlay: { flex: 1, justifyContent: 'flex-end' },
  slTpModalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)' },
  slTpModalContent: { backgroundColor: '#000000', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  slTpModalHandle: { width: 40, height: 4, backgroundColor: '#000000', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  slTpModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  slTpModalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  slTpInputGroup: { marginBottom: 16 },
  slTpLabel: { color: '#888', fontSize: 13, marginBottom: 8 },
  slTpInput: { backgroundColor: '#000000', borderRadius: 12, padding: 16, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#1a1a1a' },
  slTpCurrentInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 4 },
  slTpCurrentText: { color: '#888', fontSize: 13 },
  slTpButtonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  slTpClearBtn: { flex: 1, backgroundColor: '#000000', padding: 16, borderRadius: 12, alignItems: 'center' },
  slTpClearBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  slTpSaveBtn: { flex: 2, backgroundColor: '#22c55e', padding: 16, borderRadius: 12, alignItems: 'center' },
  slTpSaveBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  
  // Trade Details Modal - colors applied inline with theme
  tradeDetailsContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: '85%' },
  tradeDetailsScroll: { maxHeight: 500 },
  detailSection: { borderRadius: 12, padding: 16, marginBottom: 12 },
  detailSectionTitle: { color: '#22c55e', fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  detailLabel: { color: '#888', fontSize: 14 },
  detailValue: { color: '#fff', fontSize: 14, fontWeight: '500' },
  detailActions: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 20 },
  detailEditBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#22c55e20', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#22c55e' },
  detailEditText: { color: '#22c55e', fontSize: 15, fontWeight: '600' },
  detailCloseBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#22c55e', padding: 14, borderRadius: 12 },
  detailCloseText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  
  // iOS-style Confirmation Modal
  confirmModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 40 },
  confirmModalContent: { backgroundColor: '#000000', borderRadius: 20, padding: 24, width: '100%', alignItems: 'center' },
  confirmModalIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#22c55e20', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  confirmModalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  confirmModalMessage: { color: '#888', fontSize: 15, textAlign: 'center', marginBottom: 24 },
  confirmModalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmCancelBtn: { flex: 1, backgroundColor: '#000000', padding: 14, borderRadius: 12, alignItems: 'center' },
  confirmCancelText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  confirmCloseBtn: { flex: 1, backgroundColor: '#22c55e', padding: 14, borderRadius: 12, alignItems: 'center' },
  confirmCloseText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  // Close All Buttons - background applied inline with theme
  closeAllRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  closeAllBtn: { flex: 1, backgroundColor: '#22c55e20', paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#22c55e' },
  closeAllText: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  closeProfitBtn: { flex: 1, backgroundColor: '#22c55e20', paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#22c55e' },
  closeProfitText: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  closeLossBtn: { flex: 1, backgroundColor: '#22c55e20', paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#22c55e' },
  closeLossText: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  
  // Cancel Order Button
  cancelOrderBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#22c55e20', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#22c55e' },
  cancelOrderText: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  
  // Swipe to Close
  swipeCloseBtn: { backgroundColor: '#22c55e', justifyContent: 'center', alignItems: 'center', width: 80, height: '100%' },
  swipeCloseText: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 4 },
  
  tradeButton: { margin: 16, padding: 16, backgroundColor: '#22c55e', borderRadius: 12, alignItems: 'center' },
  tradeButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  
  // Order Panel
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  orderPanel: { backgroundColor: '#000000', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  orderPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  orderPanelTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  
  sideToggle: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  sideBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#000000', alignItems: 'center' },
  sideBtnSell: { backgroundColor: '#22c55e' },
  sideBtnBuy: { backgroundColor: '#22c55e' },
  sideBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sideBtnPrice: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  
  inputGroup: { marginBottom: 16 },
  inputLabel: { color: '#666', fontSize: 12, marginBottom: 8 },
  volumeInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000000', borderRadius: 12 },
  volumeBtn: { padding: 16 },
  volumeValue: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: '600' },
  
  slTpRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  slTpInputWrapper: { flex: 1 },
  input: { backgroundColor: '#000000', borderRadius: 12, padding: 14, color: '#fff', fontSize: 16 },
  
  executeBtn: { padding: 16, borderRadius: 12, alignItems: 'center' },
  executeBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  
  // History
  historyItemFull: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#000000' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historySymbol: { color: '#fff', fontSize: 16, fontWeight: '600' },
  historyPnl: { fontSize: 16, fontWeight: '600' },
  historyMeta: { flexDirection: 'row', gap: 16, marginTop: 8 },
  historyMetaText: { color: '#666', fontSize: 12 },
  historyDate: { color: '#000000', fontSize: 11, marginTop: 8 },
  historyItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#000000' },
  historyDetails: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  historyDetail: { color: '#666', fontSize: 12 },
  adminBadge: { backgroundColor: '#22c55e20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  adminBadgeText: { color: '#22c55e', fontSize: 10 },
  
  // History Filters
  historyFilters: { paddingVertical: 8, borderBottomWidth: 1 },
  historyFiltersContent: { paddingHorizontal: 12, gap: 8, flexDirection: 'row' },
  historyFilterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  historyFilterText: { fontSize: 12, fontWeight: '500' },
  historySummary: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  historySummaryText: { fontSize: 12 },
  
  // More Menu - Matching screenshot
  moreMenuHeader: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  moreMenuTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  moreMenuList: { flex: 1, paddingHorizontal: 16 },
  moreMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#000000' },
  moreMenuIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  moreMenuItemText: { flex: 1, color: '#fff', fontSize: 16 },
  themeToggleItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#000000' },
  themeToggle: { width: 50, height: 28, backgroundColor: '#000000', borderRadius: 14, justifyContent: 'center', paddingHorizontal: 2 },
  themeToggleActive: { backgroundColor: '#22c55e' },
  themeToggleThumb: { width: 24, height: 24, backgroundColor: '#fff', borderRadius: 12 },
  themeToggleThumbActive: { marginLeft: 'auto' },
  
  // Chart Tab - Full screen with multiple tabs
  chartContainer: { flex: 1, backgroundColor: '#000000' },
  chartTabsBar: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingLeft: 8, backgroundColor: '#000000', borderBottomWidth: 1, borderBottomColor: '#000000' },
  chartTabsScroll: { flexGrow: 0 },
  chartTab: { paddingHorizontal: 14, paddingVertical: 10, marginRight: 2, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  chartTabActive: { borderBottomColor: '#22c55e' },
  chartTabText: { color: '#666', fontSize: 13, fontWeight: '500' },
  chartTabTextActive: { color: '#22c55e' },
  addChartBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  chartWrapper: { flex: 1, backgroundColor: '#000000', minHeight: 400 },
  sentimentSection: { backgroundColor: '#000000', paddingHorizontal: 16, paddingVertical: 12 },
  sentimentTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  sentimentWidget: { height: 180, backgroundColor: '#0a0a0a', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#1a1a1a' },
  chartPriceBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#000000' },
  chartPriceItem: { alignItems: 'center' },
  chartPriceLabel: { color: '#666', fontSize: 11, marginBottom: 2 },
  chartBidPrice: { color: '#22c55e', fontSize: 16, fontWeight: '600' },
  chartAskPrice: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
  chartSpread: { color: '#fff', fontSize: 14 },
  chartOneClickContainer: { backgroundColor: '#000000', paddingBottom: 16 },
  chartVolumeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 16 },
  chartVolBtn: { width: 32, height: 32, backgroundColor: '#000000', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  chartVolText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  chartButtons: { flexDirection: 'row', gap: 10, paddingHorizontal: 12 },
  chartSellBtn: { flex: 1, backgroundColor: '#ef4444', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  chartBuyBtn: { flex: 1, backgroundColor: '#22c55e', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  chartBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  chartBtnLabel: { color: '#fff', fontSize: 12, fontWeight: '600', opacity: 0.9 },
  chartBtnPrice: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 2 },
  orderSlidePanel: { backgroundColor: '#000000', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  orderPanelHandle: { width: 40, height: 4, backgroundColor: '#000000', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  symbolPickerModal: { backgroundColor: '#000000', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' },
  symbolPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#000000' },
  symbolPickerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  symbolPickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#000000' },
  symbolPickerItemActive: { backgroundColor: '#22c55e10' },
  symbolPickerSymbol: { color: '#fff', fontSize: 16, fontWeight: '600' },
  symbolPickerName: { color: '#666', fontSize: 12, marginTop: 2 },
  
  // Quick Trade Bar - Screenshot Style
  quickTradeBarTop: { 
    flexDirection: 'row', 
    alignItems: 'stretch', 
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  sellPriceBtn: { 
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  sellLabel: { color: '#fff', fontSize: 11, fontWeight: '500' },
  sellPrice: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  buyPriceBtn: { 
    flex: 1,
    backgroundColor: '#22c55e',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'flex-end',
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  buyLabel: { color: '#fff', fontSize: 11, fontWeight: '500' },
  buyPrice: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  lotControlCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  lotMinusBtn: {
    width: 36,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 6,
    marginRight: 4,
  },
  lotPlusBtn: {
    width: 36,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 6,
    marginLeft: 4,
  },
  lotControlText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  lotCenterInput: {
    width: 50,
    height: 36,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 0,
  },
  btnDisabled: { opacity: 0.5 },
  
  // Leverage Picker Modal
  leverageModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  leverageModalContent: { backgroundColor: '#000000', borderRadius: 16, padding: 16, width: 200 },
  leverageModalTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  leverageModalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  leverageModalItemActive: { backgroundColor: '#22c55e20' },
  leverageModalItemText: { color: '#888', fontSize: 14, fontWeight: '600' },
  leverageModalItemTextActive: { color: '#22c55e' },
  
  // Leverage Selector
  leverageSelector: { flexDirection: 'row', gap: 6 },
  leverageOption: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#000000', borderRadius: 6, borderWidth: 1, borderColor: '#1a1a1a' },
  leverageOptionActive: { backgroundColor: '#22c55e20', borderColor: '#22c55e' },
  leverageOptionText: { color: '#888', fontSize: 12, fontWeight: '600' },
  leverageOptionTextActive: { color: '#22c55e' },
  
  // Account Selector - Below search bar
  accountSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#000000', marginHorizontal: 12, marginTop: 0, marginBottom: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#1a1a1a' },
  accountSelectorLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accountIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#22c55e20', justifyContent: 'center', alignItems: 'center' },
  accountSelectorLabel: { color: '#666', fontSize: 9 },
  accountSelectorValue: { color: '#fff', fontSize: 12, fontWeight: '600' },
  
  // Account Picker Modal
  accountPickerOverlay: { flex: 1, justifyContent: 'flex-end' },
  accountPickerBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
  accountPickerContent: { backgroundColor: '#000000', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '60%' },
  accountPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#000000' },
  accountPickerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  accountPickerList: { paddingHorizontal: 12, paddingBottom: 40 },
  accountPickerSectionTitle: { fontSize: 12, fontWeight: '600', paddingHorizontal: 4, paddingTop: 12, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  accountPickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, marginVertical: 4, backgroundColor: '#000000', borderRadius: 12 },
  accountPickerItemActive: { backgroundColor: '#22c55e15', borderWidth: 1, borderColor: '#22c55e' },
  accountPickerItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountPickerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  accountPickerIconActive: { backgroundColor: '#22c55e20' },
  accountPickerNumber: { color: '#fff', fontSize: 15, fontWeight: '600' },
  accountPickerType: { color: '#666', fontSize: 12, marginTop: 2 },
  accountPickerItemRight: { alignItems: 'flex-end', gap: 4 },
  accountPickerBalance: { color: '#22c55e', fontSize: 16, fontWeight: 'bold' },
  
  // Quick SL Modal for Challenge Accounts
  quickSlModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  quickSlModalContent: { width: '85%', borderRadius: 16, padding: 20 },
  quickSlModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  quickSlModalTitle: { fontSize: 18, fontWeight: 'bold' },
  quickSlModalSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  quickSlInputContainer: { marginBottom: 20 },
  quickSlInputLabel: { fontSize: 12, marginBottom: 6 },
  quickSlInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  quickSlHint: { fontSize: 11, marginTop: 6 },
  quickSlModalButtons: { flexDirection: 'row', gap: 10 },
  quickSlCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  quickSlCancelBtnText: { fontSize: 15, fontWeight: '600' },
  quickSlConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  quickSlConfirmBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});

export default MainTradingScreen;
