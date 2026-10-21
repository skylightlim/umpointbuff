import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { cancelBooking, getBookings } from '../services/api';
import { Booking } from '../types';

export const BookingsScreen: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchBookingsList = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getBookings();
      setBookings(data);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not fetch dashboard bookings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBookingsList();
  }, []);

  const handleCancel = (booking: Booking) => {
    if (!booking.cancel_id) {
      Alert.alert('Cannot Cancel', 'This booking does not allow cancellation.');
      return;
    }

    Alert.alert(
      'Confirm Cancellation',
      `Are you sure you want to cancel your booking for:\n\n${booking.facility}\n${booking.event_date}?`,
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(booking.cancel_id);
            try {
              const res = await cancelBooking(booking.cancel_id);
              if (res.success) {
                Alert.alert('Cancelled', 'Your reservation was successfully cancelled.');
                setBookings(res.remaining);
              }
            } catch (err: any) {
              Alert.alert('Cancellation Error', err?.message || 'Failed to cancel reservation.');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My UMPoint Bookings</Text>
        <Text style={styles.subtitle}>Active reservations on Pusat Sukan dashboard</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading dashboard reservations...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchBookingsList(true)}
              tintColor="#10b981"
            />
          }
        >
          {bookings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={64} color="#334155" />
              <Text style={styles.emptyTitle}>No Active Bookings</Text>
              <Text style={styles.emptySubtitle}>
                You have no current reservations on the UMPoint system. Head over to the Courts tab to book a slot.
              </Text>
            </View>
          ) : (
            bookings.map((b, idx) => {
              const isCancelling = cancellingId === b.cancel_id;
              const isPending = b.status.toLowerCase().includes('pending');

              return (
                <View key={b.cancel_id || idx} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardIconBox}>
                      <MaterialCommunityIcons name="badminton" size={24} color="#10b981" />
                    </View>
                    <View style={styles.cardHeaderInfo}>
                      <Text style={styles.facilityName}>{b.facility}</Text>
                      {b.cancel_id ? (
                        <Text style={styles.bookingId}>Booking ID: #{b.cancel_id}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.statusBadge, isPending ? styles.statusBadgePending : styles.statusBadgeConfirmed]}>
                      <Text style={[styles.statusBadgeText, isPending ? styles.statusTextPending : styles.statusTextConfirmed]}>
                        {b.status}
                      </Text>
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

                  {b.cancel_id ? (
                    <TouchableOpacity
                      style={[styles.cancelButton, isCancelling && styles.cancelButtonDisabled]}
                      onPress={() => handleCancel(b)}
                      disabled={isCancelling}
                    >
                      {isCancelling ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <>
                          <Ionicons name="trash-outline" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                          <Text style={styles.cancelButtonText}>Cancel Reservation</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgePending: {
    backgroundColor: '#854d0e',
  },
  statusBadgeConfirmed: {
    backgroundColor: '#065f46',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextPending: {
    color: '#fef08a',
  },
  statusTextConfirmed: {
    color: '#34d399',
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
  cancelButtonDisabled: {
    opacity: 0.5,
  },
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
});
