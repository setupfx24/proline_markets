import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HeaderLogo from "../components/HeaderLogo";
import { useTheme } from '../context/ThemeContext';

const ChallengeRulesScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();

  const rules = [
    {
      title: 'Trading Objectives',
      icon: 'trophy-outline',
      items: [
        'Achieve the profit target within the trading period',
        'Phase 1: 8% profit target',
        'Phase 2: 5% profit target',
        'Funded Account: No profit target, keep trading',
      ],
    },
    {
      title: 'Drawdown Rules',
      icon: 'trending-down-outline',
      items: [
        'Maximum Daily Drawdown: 4% of starting balance',
        'Maximum Overall Drawdown: 8% of starting balance',
        'Drawdown is calculated from highest equity point',
        'Violating drawdown limits results in account failure',
      ],
    },
    {
      title: 'Trading Restrictions',
      icon: 'ban-outline',
      items: [
        'No trading during high-impact news (optional)',
        'No holding trades over weekends (optional)',
        'No martingale or grid strategies',
        'No copy trading from external sources',
      ],
    },
    {
      title: 'Minimum Trading Days',
      icon: 'calendar-outline',
      items: [
        'Minimum 5 trading days required per phase',
        'A trading day = at least 1 trade opened',
        'Must complete minimum days before passing',
      ],
    },
    {
      title: 'Profit Split',
      icon: 'cash-outline',
      items: [
        'Up to 90% profit split on funded accounts',
        'First payout after 14 days of funded trading',
        'Bi-weekly payout schedule available',
        'No minimum withdrawal amount',
      ],
    },
    {
      title: 'Account Rules',
      icon: 'shield-checkmark-outline',
      items: [
        'KYC verification required before payout',
        'One active challenge per user at a time',
        'Account expires after 30 days of inactivity',
        'All trades must be closed before payout request',
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgPrimary, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Challenge Rules</Text>
        <HeaderLogo />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={[styles.heroSection, { backgroundColor: colors.bgCard }]}>
          <Ionicons name="trophy" size={48} color="#f59e0b" />
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Prop Trading Challenge</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
            Pass our evaluation and get funded up to $200,000
          </Text>
        </View>

        {/* Rules Sections */}
        {rules.map((section, index) => (
          <View key={index} style={[styles.ruleSection, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.ruleSectionHeader}>
              <View style={[styles.ruleIconContainer, { backgroundColor: '#f59e0b20' }]}>
                <Ionicons name={section.icon} size={20} color="#f59e0b" />
              </View>
              <Text style={[styles.ruleSectionTitle, { color: colors.textPrimary }]}>{section.title}</Text>
            </View>
            {section.items.map((item, itemIndex) => (
              <View key={itemIndex} style={styles.ruleItem}>
                <View style={[styles.ruleBullet, { backgroundColor: '#f59e0b' }]} />
                <Text style={[styles.ruleText, { color: colors.textSecondary }]}>{item}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Disclaimer */}
        <View style={[styles.disclaimer, { backgroundColor: colors.bgSecondary }]}>
          <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
            Rules may vary based on challenge type. Check your specific challenge details for exact requirements.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  heroSection: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 12,
  },
  heroSubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  ruleSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  ruleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ruleIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ruleSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingLeft: 8,
  },
  ruleBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: 10,
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 10,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});

export default ChallengeRulesScreen;
