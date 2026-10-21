import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBookings } from '../services/api';
import { useCached } from '../services/cache';
import { Button, Card, Press, Txt } from '../ui';
import { ScreenHeader, SessionPill } from '../components/Pieces';
import { UmpointSheet } from '../components/UmpointSheet';
import { Booking } from '../types';
import { radius, space, useColors } from '../theme';

/** "23/10/2026 12:00 PM - 12:30 PM" → parts to lay out; falls back to the raw text. */
function parseWhen(eventDate: string) {
  const m = eventDate.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
  if (!m) return null;
  const to24 = (t: string) => {
    const [, h, mm, ap] = t.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i)!;
    let hour = parseInt(h, 10) % 12;
    if (ap.toUpperCase() === 'PM') hour += 12;
    return `${String(hour).padStart(2, '0')}:${mm}`;
  };
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  return { day: `${day} ${+m[1]} ${month}`, start: to24(m[4]), end: to24(m[5]) };
}

function parseFacility(facility: string) {
  const m = facility.match(/Gelanggang Badminton (\d)(?:\s+J2)?\s*(.*)/i);
  return m ? { court: m[1], event: m[2] } : { court: null, event: facility };
}

export const BookingsScreen: React.FC<{ onOpenSettings: () => void }> = ({ onOpenSettings }) => {
  const c = useColors();
  const list = useCached<Booking[]>('bookings', getBookings);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <ScreenHeader title="Bookings" right={<SessionPill onOpenSettings={onOpenSettings} />} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={list.refresh} tintColor={c.mat} colors={[c.mat]} />}
      >
        <Txt variant="footnote" color={list.error ? c.smash : c.ink3} style={styles.status}>
          {list.refreshing ? 'Updating…' : list.error ? `Couldn’t refresh: ${list.error}` : 'From your UMPoint dashboard'}
        </Txt>

        {list.data === null ? (
          list.error ? (
            <Empty icon="cloud-offline-outline" title="Can’t read your bookings" text={list.error} action={<Button label="Try again" tone="plain" onPress={list.refresh} />} />
          ) : (
            <Card style={{ height: 120, backgroundColor: c.surface }}>
              <View />
            </Card>
          )
        ) : list.data.length === 0 ? (
          <Empty icon="calendar-clear-outline" title="No bookings" text="Courts you book or snipe show up here." />
        ) : (
          list.data.map((b, i) => {
            const when = parseWhen(b.event_date);
            const what = parseFacility(b.facility);
            return (
              <Card key={`${b.event_date}-${i}`} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.courtBadge, { backgroundColor: c.mat }]}>
                    <Txt variant="caption" color={c.courtLine} style={{ fontSize: 9 }}>
                      Court
                    </Txt>
                    <Txt variant="time" color={c.courtLine} style={{ fontSize: 26, lineHeight: 28 }}>
                      {what.court ?? '–'}
                    </Txt>
                  </View>
                  <View style={styles.flex}>
                    <Txt variant="caption" color={c.ink3}>
                      {when?.day ?? b.event_date}
                    </Txt>
                    {when ? (
                      <View style={styles.when}>
                        <Txt variant="time">{when.start}</Txt>
                        <Txt variant="headline" color={c.ink2}>
                          to {when.end}
                        </Txt>
                      </View>
                    ) : null}
                    {what.event ? (
                      <Txt variant="footnote" color={c.ink2} numberOfLines={1}>
                        {what.event}
                      </Txt>
                    ) : null}
                  </View>
                </View>
                {b.cancellable ? (
                  <Press onPress={() => setDashboardOpen(true)} style={styles.cancel}>
                    <Ionicons name="open-outline" size={15} color={c.smash} />
                    <Txt variant="callout" color={c.smash} style={{ fontWeight: '600' }}>
                      Cancel on UMPoint
                    </Txt>
                  </Press>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>

      <UmpointSheet
        visible={dashboardOpen}
        mode="dashboard"
        onClose={() => {
          setDashboardOpen(false);
          list.refresh();
        }}
      />
    </View>
  );
};

function Empty({ icon, title, text, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; action?: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={c.ink3} />
      <Txt variant="headline" style={{ marginTop: space.m }}>
        {title}
      </Txt>
      <Txt variant="footnote" color={c.ink2} style={{ textAlign: 'center', marginTop: 4 }}>
        {text}
      </Txt>
      {action ? <View style={{ alignSelf: 'stretch', marginTop: space.l }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: space.l,
    paddingBottom: space.xxl,
  },
  status: {
    paddingHorizontal: space.xs,
    marginBottom: space.s,
  },
  card: {
    marginBottom: space.m,
  },
  cardTop: {
    flexDirection: 'row',
    gap: space.l,
    alignItems: 'center',
  },
  courtBadge: {
    width: 56,
    height: 64,
    borderRadius: radius.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  when: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.s,
    marginVertical: 2,
  },
  cancel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: space.m,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
  },
});
