import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { GRAD } from '../theme/gradients';
import { useAuth } from '../state/AuthContext';
import { useAsk } from '../state/AskDialogContext';
import { useGo } from '../navigation/useGo';
import { useTabBarClearance } from '../navigation/TabBar';
import * as familyApi from '../lib/familyApi';
import { scopeLabel } from '../lib/familyApi';
import Head from '../components/atoms/Head';
import Card from '../components/atoms/Card';
import Mono from '../components/atoms/Mono';
import Btn from '../components/atoms/Btn';
import Press from '../components/atoms/Press';
import { G } from '../components/icons/ScreenGlyphs';
import FamilyInviteSheet, { initials } from '../components/family/FamilyInviteSheet';

const EMPTY = { sharedWithMe: [], invites: [], myFamily: [] };

function Person({ person, children, right }) {
  return (
    <View style={styles.personRow}>
      <LinearGradient colors={GRAD.colors} start={GRAD.start} end={GRAD.end} style={styles.avatar}>
        <Text style={styles.avatarLabel}>{initials(person?.name)}</Text>
      </LinearGradient>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.personName} numberOfLines={1}>
          {person?.name || 'Unknown'}
        </Text>
        <Mono style={{ marginTop: 2 }}>@{person?.username || '—'}</Mono>
        {children}
      </View>
      {right}
    </View>
  );
}

function ScopeTags({ scopes }) {
  return (
    <View style={styles.tags}>
      {scopes.map(s => (
        <View key={s} style={styles.tag}>
          <Text style={styles.tagLabel}>{scopeLabel(s)}</Text>
        </View>
      ))}
    </View>
  );
}

/* Account-based family sharing. Three lists:
     Invitations      — someone wants to share their record with you
     Shared with you  — records you can open (View details)
     Your family      — people you've shared your own record with */
export default function FamilyScreen() {
  const { user, token } = useAuth();
  const ask = useAsk();
  const go = useGo();
  const bottomPad = useTabBarClearance();
  const [family, setFamily] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(null); // link id with an action in flight
  const [sheet, setSheet] = useState(null); // null | { editing: link|null }
  const [note, setNote] = useState('');

  const say = m => {
    setNote(m);
    setTimeout(() => setNote(''), 2800);
  };

  const load = useCallback(async () => {
    try {
      const res = await familyApi.getFamily(token);
      setFamily(res);
    } catch (err) {
      say(err.message);
    } finally {
      setLoaded(true);
    }
  }, [token]);

  // reload whenever the page is opened — invitations can arrive while elsewhere in the app
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const run = async (id, fn, done) => {
    setBusy(id);
    try {
      await fn();
      if (done) say(done);
      await load();
    } catch (err) {
      say(err.message);
    } finally {
      setBusy(null);
    }
  };

  const accept = inv => run(inv.id, () => familyApi.acceptInvite(inv.id, token), `You can now see ${inv.owner.name}'s record`);

  const decline = async inv => {
    const ok = await ask({ title: `Decline ${inv.owner.name}'s invitation?`, body: 'They can send you a new one later.', confirmLabel: 'Decline', cancelLabel: 'Keep it', danger: true });
    if (ok) run(inv.id, () => familyApi.removeLink(inv.id, token), 'Invitation declined');
  };

  const leave = async link => {
    const ok = await ask({
      title: `Stop seeing ${link.owner.name}'s record?`,
      body: "You'll lose access to everything they shared. They'd have to invite you again.",
      confirmLabel: 'Leave',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (ok) run(link.id, () => familyApi.removeLink(link.id, token), `Left ${link.owner.name}'s family`);
  };

  const remove = async link => {
    const pending = link.status !== 'accepted';
    const ok = await ask({
      title: pending ? `Cancel invitation to ${link.member.name}?` : `Remove ${link.member.name}?`,
      body: pending ? 'They won’t be able to accept it anymore.' : 'They immediately lose access to your record.',
      confirmLabel: pending ? 'Cancel invitation' : 'Remove',
      cancelLabel: 'Keep',
      danger: true,
    });
    if (ok) run(link.id, () => familyApi.removeLink(link.id, token), pending ? 'Invitation cancelled' : `${link.member.name} removed`);
  };

  const submitSheet = async ({ username, scopes }) => {
    const editing = sheet?.editing;
    if (editing) await familyApi.updateScopes(editing.id, scopes, token);
    else await familyApi.invite({ username, scopes }, token);
    setSheet(null);
    say(editing ? 'Sharing updated' : `Invitation sent to @${username}`);
    load();
  };

  const view = link => go('familyMember', { ownerId: link.owner.id, name: link.owner.name, username: link.owner.username, scopes: link.scopes, openedAt: Date.now() });

  const { invites, sharedWithMe, myFamily } = family;

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: bottomPad }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[C.brand2]} />}>
      <Head title="Family" icon={G.me(C.brand)} tint={C.brand} caption={user?.username ? `you are @${user.username}` : 'share your record'} />

      {note ? (
        <View style={styles.noteBanner}>
          <Text style={styles.noteText}>{note}</Text>
        </View>
      ) : null}

      {invites.length > 0 && (
        <>
          <View style={styles.sectionPad}>
            <Mono style={{ color: C.brand2 }}>Invitations · {invites.length}</Mono>
          </View>
          {invites.map(inv => (
            <Card key={inv.id} style={styles.card}>
              <Person person={inv.owner}>
                <Text style={styles.inviteText}>wants to share their record with you</Text>
                <ScopeTags scopes={inv.scopes} />
              </Person>
              <View style={styles.row2}>
                <Btn kind="quiet" style={{ flex: 1 }} disabled={busy === inv.id} onClick={() => decline(inv)}>
                  Decline
                </Btn>
                <Btn style={{ flex: 1 }} disabled={busy === inv.id} onClick={() => accept(inv)}>
                  {busy === inv.id ? 'Accepting…' : 'Accept'}
                </Btn>
              </View>
            </Card>
          ))}
        </>
      )}

      <View style={styles.sectionPad}>
        <Mono>Shared with you</Mono>
      </View>
      {sharedWithMe.length === 0 ? (
        <Card style={styles.card}>
          <Text style={styles.emptyText}>{loaded ? `No one has shared their record with you yet. Give family your username — @${user?.username} — so they can invite you.` : 'Loading…'}</Text>
        </Card>
      ) : (
        sharedWithMe.map(link => (
          <Card key={link.id} style={styles.card}>
            <Person person={link.owner}>
              <ScopeTags scopes={link.scopes} />
            </Person>
            <View style={styles.row2}>
              <Btn kind="quiet" style={{ flex: 1 }} disabled={busy === link.id} onClick={() => leave(link)}>
                Leave
              </Btn>
              <Btn style={{ flex: 2 }} onClick={() => view(link)}>
                View details
              </Btn>
            </View>
          </Card>
        ))
      )}

      <View style={styles.sectionPad}>
        <Mono>Your family</Mono>
      </View>
      <Card style={styles.card}>
        <Text style={styles.emptyText}>
          {myFamily.length ? 'People you’ve shared your record with. Tap Edit to change what they can see.' : 'Invite family by their username. You choose which sections of your record they can see and edit.'}
        </Text>
        {myFamily.map(link => (
          <View key={link.id} style={styles.memberBlock}>
            <Person
              person={link.member}
              right={
                <View style={styles.memberActions}>
                  <Press onPress={() => setSheet({ editing: link })} style={styles.smallBtn}>
                    <Text style={styles.smallBtnLabel}>Edit</Text>
                  </Press>
                  <Press onPress={() => remove(link)} disabled={busy === link.id} style={styles.smallBtn}>
                    <Text style={[styles.smallBtnLabel, { color: C.stage2 }]}>Remove</Text>
                  </Press>
                </View>
              }>
              {link.status !== 'accepted' && <Mono style={{ marginTop: 4, color: C.elevated }}>Invitation pending</Mono>}
              <ScopeTags scopes={link.scopes} />
            </Person>
          </View>
        ))}
        <Btn style={{ marginTop: 14 }} onClick={() => setSheet({ editing: null })}>
          + Invite someone
        </Btn>
      </Card>

      {sheet && <FamilyInviteSheet editing={sheet.editing} onSubmit={submitSheet} onClose={() => setSheet(null)} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 20, paddingBottom: 120 },
  noteBanner: { marginBottom: 6, backgroundColor: C.panelSoft, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  noteText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.onPanel2 },
  sectionPad: { paddingTop: 18, paddingHorizontal: 4, paddingBottom: 10 },
  card: { marginBottom: 10 },
  personRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarLabel: { fontFamily: SANS.bold, fontSize: 16, color: '#FFFFFF' },
  personName: { fontFamily: SANS.semibold, fontSize: 16.5, letterSpacing: -0.3, color: C.ink },
  inviteText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, marginTop: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11, backgroundColor: C.panelSoft },
  tagLabel: { fontFamily: SANS.semibold, fontSize: 12.5, color: C.brand2 },
  row2: { flexDirection: 'row', gap: 8, marginTop: 14 },
  emptyText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, lineHeight: 21 },
  memberBlock: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.hair },
  memberActions: { gap: 6, alignItems: 'flex-end' },
  smallBtn: { borderWidth: 1, borderColor: C.hair, backgroundColor: C.cardSolid, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 },
  smallBtnLabel: { fontFamily: SANS.semibold, fontSize: 13.5, color: C.ink },
});
