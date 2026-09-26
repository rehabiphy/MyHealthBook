import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../theme/colors';
import { GRAD_SHEET } from '../../theme/gradients';
import { SANS } from '../../theme/typography';
import { searchMedicineCatalog } from '../../lib/medsApi';
import { useAuth } from '../../state/AuthContext';
import Mono from '../atoms/Mono';
import Press from '../atoms/Press';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

/* Full-screen search over the medicine catalog. Types-as-you-go with a
   debounce, loads the next page as the list nears its end, and always
   offers the typed text itself so a medicine missing from the list can
   still be added. onPick receives { name, composition?, manufacturer? }. */
export default function MedicinePickerSheet({ initialQuery = '', onPick, onClose }) {
  const { token } = useAuth();
  const insets = useSafeAreaInsets(); // the Modal draws edge-to-edge, under the status and nav bars
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const reqId = useRef(0); // drops responses from searches the user has already typed past
  const loadingRef = useRef(false);
  const loadedQuery = useRef(null); // query the current `items` belong to

  const load = useCallback(
    async (q, nextPage) => {
      const id = ++reqId.current;
      loadingRef.current = true;
      setLoading(true);
      setError('');
      try {
        const res = await searchMedicineCatalog({ q, page: nextPage, limit: PAGE_SIZE }, token);
        if (id !== reqId.current) return;
        loadedQuery.current = q;
        setItems(prev => (nextPage === 1 ? res.items : [...prev, ...res.items]));
        setPage(nextPage);
        setHasMore(res.hasMore);
      } catch (err) {
        if (id === reqId.current) setError(err.message);
      } finally {
        if (id === reqId.current) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [token],
  );

  // new query → restart from page 1 after the user pauses typing
  useEffect(() => {
    const t = setTimeout(() => load(query.trim(), 1), query ? DEBOUNCE_MS : 0);
    return () => clearTimeout(t);
  }, [query, load]);

  const loadMore = () => {
    // mid-debounce the list still shows the previous query's pages — don't extend those
    if (loadingRef.current || !hasMore || error || page === 0 || loadedQuery.current !== query.trim()) return;
    load(query.trim(), page + 1);
  };

  const typed = query.trim();
  const pick = med => {
    Keyboard.dismiss();
    onPick(med);
  };

  const renderItem = ({ item }) => (
    <Press onPress={() => pick({ name: item.name, composition: item.composition, manufacturer: item.manufacturer })} style={styles.row}>
      <Text style={styles.rowName} numberOfLines={2}>
        {item.name}
      </Text>
      {item.composition ? (
        <Text style={styles.rowComp} numberOfLines={2}>
          {item.composition}
        </Text>
      ) : null}
      <Mono style={{ marginTop: 4 }} numberOfLines={1}>
        {[item.manufacturer, item.packSize].filter(Boolean).join(' · ')}
        {item.discontinued ? ' · discontinued' : ''}
      </Mono>
    </Press>
  );

  const header = typed ? (
    <Press onPress={() => pick({ name: typed })} style={[styles.row, styles.customRow]}>
      <Text style={styles.customLabel}>Use “{typed}”</Text>
      <Mono style={{ marginTop: 3 }}>Not in the list? Add it by this name</Mono>
    </Press>
  ) : null;

  const footer = loading ? (
    <View style={styles.footer}>
      <ActivityIndicator color={C.brand2} />
    </View>
  ) : error ? (
    <View style={styles.footer}>
      <Text style={styles.emptyText}>{error}</Text>
      <Press onPress={() => load(typed, items.length ? page + 1 : 1)} style={styles.retryBtn}>
        <Text style={styles.retryLabel}>Try again</Text>
      </Press>
    </View>
  ) : !hasMore && items.length > 0 ? (
    <View style={styles.footer}>
      <Mono>End of list</Mono>
    </View>
  ) : null;

  const empty = !loading && !error ? <Text style={[styles.emptyText, { padding: 20 }]}>No medicines match “{typed}”. You can still add it by this name above.</Text> : null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <LinearGradient colors={GRAD_SHEET.colors} locations={GRAD_SHEET.locations} start={GRAD_SHEET.start} end={GRAD_SHEET.end} style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 16, paddingLeft: insets.left + 18, paddingRight: insets.right + 18 }]}>
          <View>
            <Text style={styles.h2}>Choose a medicine</Text>
            <Mono style={{ marginTop: 3 }}>Search by brand or salt name</Mono>
          </View>
          <Press onPress={onClose} style={styles.closeBtn}>
            <Svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2" strokeLinecap="round">
              <Path d="M6 6l12 12M18 6L6 18" />
            </Svg>
          </Press>
        </View>

        <View style={styles.searchBox}>
          <Svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round">
            <Circle cx="11" cy="11" r="7" />
            <Path d="M20 20l-3.5-3.5" />
          </Svg>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="e.g. Dolo 650, Telmisartan"
            placeholderTextColor={C.ink3}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={styles.searchInput}
          />
          {query ? (
            <Press onPress={() => setQuery('')} style={styles.clearBtn}>
              <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.ink2} strokeWidth="2.4" strokeLinecap="round">
                <Path d="M6 6l12 12M18 6L6 18" />
              </Svg>
            </Press>
          ) : null}
        </View>

        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ListEmptyComponent={typed ? empty : null}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={PAGE_SIZE}
          windowSize={11}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
        />
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.hair,
  },
  h2: { fontFamily: SANS.bold, fontSize: 19, letterSpacing: -0.6, color: C.ink },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.hair,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.hair,
    backgroundColor: C.cardSolid,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontFamily: SANS.medium, fontSize: 16, color: C.ink },
  clearBtn: { width: 24, height: 24, borderRadius: 999, backgroundColor: 'rgba(22,36,28,0.08)', alignItems: 'center', justifyContent: 'center' },
  row: { paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.hair },
  rowName: { fontFamily: SANS.semibold, fontSize: 15.5, letterSpacing: -0.3, color: C.ink },
  rowComp: { fontFamily: SANS.regular, fontSize: 14, color: C.ink2, marginTop: 3, lineHeight: 19 },
  customRow: { backgroundColor: C.panelSoft, borderRadius: 14, borderBottomWidth: 0, paddingHorizontal: 14, marginBottom: 6 },
  customLabel: { fontFamily: SANS.semibold, fontSize: 15.5, color: C.ink },
  footer: { paddingVertical: 20, alignItems: 'center', gap: 10 },
  emptyText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, lineHeight: 21, textAlign: 'center' },
  retryBtn: { borderWidth: 1, borderColor: C.hair, backgroundColor: C.cardSolid, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 15 },
  retryLabel: { fontFamily: SANS.semibold, fontSize: 14.5, color: C.ink },
});
