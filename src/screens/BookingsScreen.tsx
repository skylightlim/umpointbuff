import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { getBookings } from '../services/api';
import { useCached } from '../services/cache';
import { Button, Card, Txt } from '../ui';
import { Empty, ScreenHeader, SessionPill, TAB_CLEARANCE } from '../components/Pieces';
import { UmpointSheet } from '../components/UmpointSheet';
import { Booking } from '../types';
import { elevation, shape, space, useColors } from '../theme';

/** "23/10/2026 12:00 PM - 12:30 PM" → parts to lay out; falls back to raw text. */
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
    <View style={[styles.flex, { backgroundColor: c.surface }]}>
      <ScreenHeader title="Bookings" right={<SessionPill onOpenSettings={onOpenSettings} />} />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={list.refresh} tintColor={c.primary} colors={[c.primary]} />}
      >
        <Txt variant="labelSmall" color={list.error ? c.error : c.onSurfaceVariant} style={styles.status}>
          {list.refreshing ? 'Updating…' : list.error ? `Couldn’t refresh: ${list.error}` : 'From your UMPoint dashboard'}
        </Txt>

        {list.data === null ? (
          list.error ? (
            <Empty
              icon="cloud-offline-outline"
              title="Cannot load bookings"
              text={list.error}
              action={<Button label="Try again" tone="tonal" onPress={list.refresh} />}
            />
          ) : (
            <Card style={{ height: 120, backgroundColor: c.surfaceContainerLow }}>
              <View />
            </Card>
          )
        ) : list.data.length === 0 ? (
          <Empty
            icon="calendar-clear-outline"
            title="No active bookings"
            text="Courts you book or successfully snipe will appear here."
          />
        ) : (
          list.data.map((b, i) => {
            const when = parseWhen(b.event_date);
            const what = parseFacility(b.facility);

            return (
              <Card
                key={`${b.event_date}-${i}`}
                style={[
                  styles.card,
                  {
                    backgroundColor: c.surfaceContainerLow,
                    borderColor: c.outlineVariant,
                    borderWidth: 1,
                    elevation: elevation.level1,
                  },
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.courtBadge, { backgroundColor: c.secondaryContainer }]}>
                    <Txt variant="labelSmall" color={c.onSecondaryContainer} style={{ fontSize: 10 }}>
                      Court
                    </Txt>
                    <Txt variant="titleLarge" color={c.onSecondaryContainer} style={{ fontSize: 24, lineHeight: 28, fontWeight: '700' }}>
                      {what.court ?? '–'}
                    </Txt>
                  </View>

                  <View style={styles.flex}>
                    <Txt variant="labelMedium" color={c.onSurfaceVariant}>
                      {when?.day ?? b.event_date}
                    </Txt>
                    {when ? (
                      <View style={styles.when}>
                        <Txt variant="headlineSmall" color={c.onSurface}>{when.start}</Txt>
                        <Txt variant="bodyMedium" color={c.onSurfaceVariant}>
                          to {when.end}
                        </Txt>
                      </View>
                    ) : null}
                    {what.event ? (
                      <Txt variant="bodySmall" color={c.onSurfaceVariant} numberOfLines={1}>
                        {what.event}
                      </Txt>
                    ) : null}
                  </View>
                </View>

                {b.cancellable ? (
                  <View style={styles.actionRow}>
                    <Button
                      label="Cancel on UMPoint"
                      tone="danger"
                      size="m"
                      icon="open-outline"
                      onPress={() => setDashboardOpen(true)}
                    />
                  </View>
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

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: space.l,
    paddingBottom: TAB_CLEARANCE + space.xxl,
  },
  status: {
    paddingHorizontal: space.xs,
    marginBottom: space.s,
  },
  card: {
    borderRadius: shape.large,
    padding: space.l,
    marginBottom: space.m,
  },
  cardTop: {
    flexDirection: 'row',
    gap: space.m,
    alignItems: 'center',
  },
  courtBadge: {
    width: 60,
    height: 64,
    borderRadius: shape.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  when: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.s,
    marginVertical: 2,
  },
  actionRow: {
    marginTop: space.l,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
});
