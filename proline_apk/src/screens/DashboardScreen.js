import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HeaderLogo from "../components/HeaderLogo";
import { useNavigation } from '@react-navigation/native';
import { API_URL } from '../config';
import { useTheme } from '../context/ThemeContext';

const DashboardScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [marketWatchNews, setMarketWatchNews] = useState([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const refreshIntervalRef = useRef(null);

  // Fetch MarketWatch news from backend
  const fetchMarketWatchNews = async () => {
    try {
      const response = await fetch(`${API_URL}/news/marketwatch`);
      const data = await response.json();
      
      if (data.success && data.news) {
        setMarketWatchNews(data.news);
      }
    } catch (e) {
      console.error('Error fetching MarketWatch news:', e);
      // Fallback to RSS feed parsing
      try {
        const rssResponse = await fetch('https://feeds.content.dowjones.io/public/rss/mw_topstories');
        const rssText = await rssResponse.text();
        const items = parseRSSFeed(rssText);
        setMarketWatchNews(items);
      } catch (rssError) {
        console.error('RSS fallback failed:', rssError);
        // Use placeholder data
        setMarketWatchNews([
          { id: '1', title: 'Markets Update: Loading latest news...', source: 'MarketWatch', time: 'Just now', category: 'Markets', url: 'https://www.marketwatch.com' },
        ]);
      }
    } finally {
      setLoadingNews(false);
    }
  };

  // Parse RSS feed
  const parseRSSFeed = (xmlText) => {
    const items = [];
    const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/g) || [];
    
    itemMatches.slice(0, 50).forEach((item, index) => {
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
      const linkMatch = item.match(/<link>(.*?)<\/link>/);
      const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
      const categoryMatch = item.match(/<category>(.*?)<\/category>/);
      
      if (titleMatch) {
        items.push({
          id: `mw-${index}`,
          title: titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
          url: linkMatch ? linkMatch[1] : 'https://www.marketwatch.com',
          time: pubDateMatch ? formatTimeAgo(pubDateMatch[1]) : '',
          category: categoryMatch ? categoryMatch[1] : 'Markets',
          source: 'MarketWatch'
        });
      }
    });
    
    return items;
  };

  const formatTimeAgo = (datetime) => {
    if (!datetime) return '';
    const now = new Date();
    const date = new Date(datetime);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Initial fetch and set up auto-refresh every 30 seconds
  useEffect(() => {
    fetchMarketWatchNews();
    
    refreshIntervalRef.current = setInterval(() => {
      fetchMarketWatchNews();
    }, 30000); // Refresh every 30 seconds
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMarketWatchNews();
    setRefreshing(false);
  };

  const openNewsUrl = (url) => {
    if (url) {
      Linking.openURL(url);
    }
  };

  const getImpactColor = (impact) => {
    switch (impact) {
      case 'high': return '#22c55e';
      case 'medium': return '#22c55e';
      case 'low': return '#22c55e';
      default: return '#666';
    }
  };

  const quickActions = [
    { id: 'accounts', icon: 'wallet-outline', label: 'Accounts', screen: 'Accounts', color: '#22c55e' },
    { id: 'wallet', icon: 'card-outline', label: 'Wallet', screen: 'Wallet', color: '#22c55e' },
    { id: 'copy', icon: 'copy-outline', label: 'Copy Trade', screen: 'CopyTrading', color: '#22c55e' },
    { id: 'ib', icon: 'people-outline', label: 'IB Program', screen: 'IB', color: '#22c55e' },
  ];

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.bgPrimary }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Brand Bar */}
      <View style={styles.brandBar}>
        <HeaderLogo size={32} />
        <Text style={[styles.brandBarText, { color: colors.textPrimary }]}>ProlineMarkets</Text>
      </View>
      {/* Quick Actions */}
      <View style={styles.quickActionsSection}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map(action => (
            <TouchableOpacity 
              key={action.id} 
              style={[styles.quickActionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={() => navigation.navigate(action.screen)}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: action.color + '20' }]}>
                <Ionicons name={action.icon} size={24} color={action.color} />
              </View>
              <Text style={[styles.quickActionLabel, { color: colors.textPrimary }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* MarketWatch Real-Time News */}
      <View style={styles.newsSection}>
        <View style={styles.newsSectionHeader}>
          <View style={styles.newsTitleRow}>
            <Ionicons name="newspaper-outline" size={20} color={colors.accent} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>MarketWatch News</Text>
          </View>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
        
        {loadingNews ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading latest news...</Text>
          </View>
        ) : (
          <View style={styles.newsContent}>
            {marketWatchNews.map((item, index) => (
              <TouchableOpacity 
                key={item.id || index} 
                style={[styles.newsItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                onPress={() => openNewsUrl(item.url)}
                activeOpacity={0.7}
              >
                <View style={styles.newsItemHeader}>
                  <View style={styles.newsCategory}>
                    <Text style={styles.newsCategoryText}>{item.category || 'Markets'}</Text>
                  </View>
                  <Text style={[styles.newsTime, { color: colors.textMuted }]}>{item.time}</Text>
                </View>
                <Text style={[styles.newsTitle, { color: colors.textPrimary }]} numberOfLines={3}>{item.title}</Text>
                <View style={styles.newsMeta}>
                  <View style={styles.sourceRow}>
                    <Ionicons name="globe-outline" size={12} color={colors.textMuted} />
                    <Text style={[styles.newsSource, { color: colors.textMuted }]}>{item.source || 'MarketWatch'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  brandBarText: { fontSize: 18, fontWeight: '700' },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Quick Actions
  quickActionsSection: {
    marginTop: 8,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 12,
  },
  quickActionCard: {
    width: '47%',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // News Section
  newsSection: {
    flex: 1,
    marginTop: 8,
  },
  newsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  newsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef444420',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
    marginRight: 4,
  },
  liveText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
    marginTop: 12,
  },
  
  // Market News
  newsContent: {
    marginHorizontal: 16,
  },
  newsItem: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  newsItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  newsCategory: {
    backgroundColor: '#22c55e20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  newsCategoryText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '600',
  },
  newsTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 10,
  },
  newsMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  newsSource: {
    color: '#888',
    fontSize: 12,
  },
  newsTime: {
    color: '#666',
    fontSize: 11,
  },
});

export default DashboardScreen;
