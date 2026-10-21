import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getBookings } from '../services/api';
import { UmpointSheet } from '../components/UmpointSheet';
import { Booking } from '../types';

export const BookingsScreen: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboardOpen, setDashboardOpen] = useState<boolean>(false);

  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    let current = true;
    getBookings()
      .then(
        (list) => {
          if (!current) return;
          setBookings(list);
          setError(null);
        },
        (err: any) => current && setError(err?.message || 'Could not read your UMPoint dashboard.'),
      )
      .finally(() => {
        if (!current) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      current = false;
    };
  }, [reloadKey]);

  const refresh = () => {
    setRefreshing(true);
    setReloadKey((k) => k + 1);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My UMPoint Bookings</Text>
        <Text style={styles.subtitle}>Active reservations on your Pusat Sukan dashboard</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Reading your dashboard...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#10b981" />}
        >
          {error ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cloud-offline-outline" size={56} color="#334155" />
              <Text style={styles.emptyTitle}>Couldn&apos;t load bookings</Text>
              <Text style={styles.emptySubtitle}>{error} Pull down to try again.</Text>
            </View>
          ) : bookings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={64} color="#334155" />
              <Text style={styles.emptyTitle}>No Active Bookings</Text>
              <Text style={styles.emptySubtitle}>
                You have no current reservations on UMPoint. Head over to the Courts tab to book a slot.
              </Text>
            </View>
          ) : (
            bookings.map((b, idx) => (
              <View key={`${b.event_date}-${idx}`} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconBox}>
                    <MaterialCommunityIcons name="badminton" size={24} color="#10b981" />
                  </View>
                  <View style={styles.cardHeaderInfo}>
                    <Text style={styles.facilityName}>{b.facility}</Text>
                    {b.invoice ? <Text style={styles.bookingId}>Invoice {b.invoice}</Text> : null}
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={16} color="#94a3b8" />
                  <Text style={styles.detailText}>{b.event_date}</Text>
                </View>

                {b.booking_date ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={16} color="#94a3b8" />
                    <Text style={styles.detailSubText}>Booked on: {b.booking_date}</Text>
                  </View>
                ) : null}

                {b.cancellable ? (
                  <TouchableOpacity style={styles.cancelButton} onPress={() => setDashboardOpen(true)}>
                    <Ionicons name="open-outline" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                    <Text style={styles.cancelButtonText}>Cancel on UMPoint</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}

      <UmpointSheet
        visible={dashboardOpen}
        mode="dashboard"
        onClose={() => {
          setDashboardOpen(false);
          refresh();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#cbd5e1',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#131b2e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#064e3b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderInfo: {
    flex: 1,
  },
  facilityName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  bookingId: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  detailText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  detailSubText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
});
