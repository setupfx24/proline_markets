import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { vantage } from '../../../theme/vantageTheme';

const colors = {
  bgPrimary: vantage.bg,
  bgSecondary: vantage.bgRaised,
  bgCard: vantage.bgElevated,
  bgHover: vantage.bgPressed,
  border: vantage.border,
  textPrimary: vantage.textPrimary,
  textSecondary: vantage.textSecondary,
  textMuted: vantage.textMuted,
  primary: vantage.accent,
  accent: vantage.accent,
  success: vantage.up,
  error: vantage.down,
  warning: '#F59E0B',
  profitColor: vantage.up,
};
import { useI18n } from '../../../i18n';
import useRiskCalculator from '../../../hooks/useRiskCalculator';
import ScreenHeader from '../../../components/ui/ScreenHeader';
import TabBar from '../../../components/ui/TabBar';

// Tab keys must match the i18n keys under riskCalc.* (e.g. lotSizeCalc, not lotsizeCalc).
const CALC_TABS = [
  { key: 'margin', icon: 'shield-outline' },
  { key: 'pnl', icon: 'trending-up-outline' },
  { key: 'lotSize', icon: 'resize-outline' },
  { key: 'swap', icon: 'swap-horizontal-outline' },
];

// Common symbols available in the picker — covers forex majors, metals,
// indices and crypto so users can change the instrument used by all calcs.
const INSTRUMENT_OPTIONS = [
  { group: 'Forex', symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD', 'EURGBP', 'EURJPY', 'GBPJPY'] },
  { group: 'Metals', symbols: ['XAUUSD', 'XAGUSD'] },
  { group: 'Indices', symbols: ['US30', 'US100', 'US500', 'GER40', 'UK100', 'JPN225'] },
  { group: 'Crypto', symbols: ['BTCUSD', 'ETHUSD', 'LTCUSD', 'XRPUSD', 'SOLUSD', 'BNBUSD', 'DOGEUSD', 'ADAUSD'] },
];

function InputRow({ label, value, onChangeText, placeholder, colors, keyboardType = 'decimal-pad' }) {
  return (
    <View style={s.inputRow}>
      <Text style={[s.inputLabel, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        style={[s.input, { backgroundColor: colors.bgSecondary, color: colors.textPrimary, borderColor: colors.border }]}
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={colors.textMuted} keyboardType={keyboardType}
      />
    </View>
  );
}

function ResultBox({ label, value, valueColor, colors }) {
  return (
    <View style={[s.resultBox, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
      <Text style={[s.resultLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[s.resultValue, { color: valueColor || colors.primary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{value}</Text>
    </View>
  );
}

function DirectionToggle({ direction, setDirection, colors, t }) {
  return (
    <View style={s.dirRow}>
      <Text style={[s.inputLabel, { color: colors.textMuted }]}>{t('riskCalc.direction')}</Text>
      <View style={s.dirBtns}>
        {['buy', 'sell'].map(d => (
          <TouchableOpacity key={d}
            style={[s.dirBtn, direction === d && { backgroundColor: d === 'buy' ? colors.success : colors.error }]}
            onPress={() => setDirection(d)}
          >
            <Text style={{ color: direction === d ? '#fff' : colors.textSecondary, fontWeight: '600', fontSize: 13 }}>
              {d === 'buy' ? t('riskCalc.buy') : t('riskCalc.sell')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function RiskCalculatorScreen({ navigation }) {
  const isDark = true;
  const { t } = useI18n();
  const calc = useRiskCalculator();
  const [activeTab, setActiveTab] = useState('margin');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const tabs = CALC_TABS.map(tb => ({ key: tb.key, label: t(`riskCalc.${tb.key}Calc`) }));

  const filteredGroups = useMemo(() => {
    const q = pickerSearch.trim().toUpperCase();
    if (!q) return INSTRUMENT_OPTIONS;
    return INSTRUMENT_OPTIONS
      .map(g => ({ ...g, symbols: g.symbols.filter(s => s.includes(q)) }))
      .filter(g => g.symbols.length > 0);
  }, [pickerSearch]);

  const marginResult = useMemo(() => calc.calcMargin(), [calc.calcMargin]);
  const pnlResult = useMemo(() => calc.calcPnl(), [calc.calcPnl]);
  const lotResult = useMemo(() => calc.calcLotSize(), [calc.calcLotSize]);
  const swapResult = useMemo(() => calc.calcSwap(), [calc.calcSwap]);

  return (
    <View style={[s.container, { backgroundColor: colors.bgPrimary }]}>
      <ScreenHeader title={t('riskCalc.title')} subtitle={t('riskCalc.subtitle')} onBack={() => navigation.goBack()} />
      <TabBar tabs={tabs} activeTab={activeTab} onTabPress={setActiveTab} scrollable />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Instrument selector — tap to change */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={[s.instrumentBar, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          onPress={() => { setPickerSearch(''); setPickerOpen(true); }}
        >
          <Ionicons name="bar-chart-outline" size={18} color={colors.primary} />
          <Text style={[s.instrumentText, { color: colors.textPrimary, flex: 1 }]}>{calc.instrument}</Text>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {activeTab === 'margin' && (
          <>
            <InputRow label={t('riskCalc.entryPrice')} value={calc.entryPrice} onChangeText={calc.setEntryPrice} placeholder="1.08500" colors={colors} />
            <InputRow label={t('riskCalc.lotSize')} value={calc.lotSize} onChangeText={calc.setLotSize} placeholder="0.01" colors={colors} />
            <InputRow label={t('riskCalc.leverage')} value={calc.leverage} onChangeText={calc.setLeverage} placeholder="100" colors={colors} />
            <DirectionToggle direction={calc.direction} setDirection={calc.setDirection} colors={colors} t={t} />
            <ResultBox label={t('riskCalc.requiredMargin')} value={`$${marginResult.toFixed(2)}`} colors={colors} />
          </>
        )}

        {activeTab === 'pnl' && (
          <>
            <InputRow label={t('riskCalc.entryPrice')} value={calc.entryPrice} onChangeText={calc.setEntryPrice} placeholder="1.08500" colors={colors} />
            <InputRow label={t('riskCalc.exitPrice')} value={calc.exitPrice} onChangeText={calc.setExitPrice} placeholder="1.09000" colors={colors} />
            <InputRow label={t('riskCalc.lotSize')} value={calc.lotSize} onChangeText={calc.setLotSize} placeholder="0.01" colors={colors} />
            <DirectionToggle direction={calc.direction} setDirection={calc.setDirection} colors={colors} t={t} />
            <ResultBox label={t('riskCalc.profitLoss')} value={`${pnlResult >= 0 ? '+' : ''}$${pnlResult.toFixed(2)}`}
              valueColor={pnlResult >= 0 ? colors.success : colors.error} colors={colors} />
          </>
        )}

        {activeTab === 'lotSize' && (
          <>
            <InputRow label={t('riskCalc.riskAmount')} value={calc.riskAmount} onChangeText={calc.setRiskAmount} placeholder="100" colors={colors} />
            <InputRow label={t('riskCalc.stopLossPips')} value={calc.stopLossPips} onChangeText={calc.setStopLossPips} placeholder="20" colors={colors} />
            <ResultBox label={t('riskCalc.recommendedLot')} value={lotResult.toFixed(2)} colors={colors} />
          </>
        )}

        {activeTab === 'swap' && (
          <>
            <InputRow label={t('riskCalc.lotSize')} value={calc.lotSize} onChangeText={calc.setLotSize} placeholder="0.01" colors={colors} />
            <InputRow label={t('riskCalc.swapLong')} value={calc.swapLong} onChangeText={calc.setSwapLong} placeholder="-0.5" colors={colors} />
            <InputRow label={t('riskCalc.swapShort')} value={calc.swapShort} onChangeText={calc.setSwapShort} placeholder="-0.3" colors={colors} />
            <View style={s.swapResults}>
              <ResultBox label={`${t('riskCalc.swapLong')} / ${t('riskCalc.dailyCost')}`}
                value={`$${swapResult.longDaily.toFixed(2)}`}
                valueColor={swapResult.longDaily >= 0 ? colors.success : colors.error} colors={colors} />
              <ResultBox label={`${t('riskCalc.swapShort')} / ${t('riskCalc.dailyCost')}`}
                value={`$${swapResult.shortDaily.toFixed(2)}`}
                valueColor={swapResult.shortDaily >= 0 ? colors.success : colors.error} colors={colors} />
            </View>
          </>
        )}
      </ScrollView>

      {/* Instrument picker modal */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={s.pickerOverlay}>
          <View style={[s.pickerSheet, { backgroundColor: colors.bgCard }]}>
            <View style={s.pickerHeader}>
              <Text style={[s.pickerTitle, { color: colors.textPrimary }]}>{t('riskCalc.selectInstrument') || 'Select Instrument'}</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={[s.pickerSearchBox, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={[s.pickerSearchInput, { color: colors.textPrimary }]}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Search symbol…"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
              />
            </View>
            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
              {filteredGroups.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ color: colors.textMuted }}>No matches</Text>
                </View>
              ) : filteredGroups.map(group => (
                <View key={group.group} style={{ marginBottom: 8 }}>
                  <Text style={[s.pickerGroupHead, { color: colors.textMuted }]}>{group.group}</Text>
                  {group.symbols.map(sym => (
                    <TouchableOpacity
                      key={sym}
                      style={[s.pickerRow, { borderBottomColor: colors.border }]}
                      onPress={() => { calc.setInstrument(sym); setPickerOpen(false); }}
                    >
                      <Ionicons name="bar-chart-outline" size={16} color={colors.primary} />
                      <Text style={[s.pickerSymbol, { color: colors.textPrimary, flex: 1 }]}>{sym}</Text>
                      {calc.instrument === sym && (
                        <Ionicons name="checkmark" size={18} color={colors.success} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 100 },
  instrumentBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  instrumentText: { fontSize: 15, fontWeight: '700' },
  inputRow: { marginBottom: 16 },
  inputLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  // Fixed height + centered text so the box never grows/jumps when focused
  // (Android grows an unsized TextInput on focus due to font padding).
  input: { borderRadius: 12, borderWidth: 1, height: 50, paddingHorizontal: 14, paddingVertical: 0, fontSize: 16, fontWeight: '600', textAlignVertical: 'center', includeFontPadding: false },
  dirRow: { marginBottom: 20 },
  dirBtns: { flexDirection: 'row', gap: 10, marginTop: 6 },
  dirBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  resultBox: { borderRadius: 14, borderWidth: 1, padding: 20, alignItems: 'center', marginTop: 8 },
  resultLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  resultValue: { fontSize: 28, fontWeight: '800' },
  swapResults: { gap: 10, marginTop: 8 },
  // Instrument picker modal
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pickerTitle: { fontSize: 17, fontWeight: '700' },
  pickerSearchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  pickerSearchInput: { flex: 1, fontSize: 14, padding: 0 },
  pickerGroupHead: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 8, marginBottom: 4 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  pickerSymbol: { fontSize: 14, fontWeight: '600' },
});
