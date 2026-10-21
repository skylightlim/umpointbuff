import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { bookCourt, getGrid, scheduleSnipe } from '../services/api';
import { CourtId, GridResponse, WeekType } from '../types';

interface Props {
  onNavigateToSniper?: () => void;
  onNavigateToBookings?: () => void;
}

export const CourtsScreen: React.FC<Props> = ({ onNavigateToSniper, onNavigateToBookings }) => {
  const [selectedWeek, setSelectedWeek] = useState<WeekType>('this');
  const [selectedCourt, setSelectedCourt] = useState<CourtId>('1');
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(0);
  const [gridData, setGridData] = useState<GridResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Selection for booking / sniping
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [slotDuration, setSlotDuration] = useState<number>(1); // 1 = 30 min, 2 = 1 hr, 3 = 1.5 hr, 4 = 2 hr
  const [eventTitle, setEventTitle] = useState<string>('Badminton practice');
  const [pax, setPax] = useState<number>(4);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  const fetchGrid = async (court: CourtId, week: WeekType, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getGrid(court, week);
      setGridData(data);
    } catch (err: any) {
      Alert.alert('Error Fetching Court Schedule', err?.message || 'Could not connect to server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGrid(selectedCourt, selectedWeek);
  }, [selectedCourt, selectedWeek]);

  const dates = gridData?.dates || [];
  const currentDateStr = dates[selectedDateIndex] || '';

  const daySlots = useMemo(() => {
    if (!gridData) return [];
    return gridData.slots.map((slot, index) => {
      const cell = slot.cells[selectedDateIndex];
      return {
        index,
        time_start: slot.time_start,
        time_end: slot.time_end,
        status: cell?.status || 'unavailable',
        cell_id: cell?.cell_id || '',
        text: cell?.text || '',
      };
    });
  }, [gridData, selectedDateIndex]);

  // Derived selected times
  const selectedRange = useMemo(() => {
    if (selectedSlotIndex === null || !daySlots[selectedSlotIndex]) return null;
    const startSlot = daySlots[selectedSlotIndex];
    const endIndex = Math.min(daySlots.length - 1, selectedSlotIndex + slotDuration - 1);
    const endSlot = daySlots[endIndex];
    return {
      start: startSlot.time_start,
      end: endSlot.time_end,
      isValid: daySlots.slice(selectedSlotIndex, endIndex + 1).every((s) => s.status === 'free'),
    };
  }, [selectedSlotIndex, slotDuration, daySlots]);

  const handleSelectSlot = (idx: number) => {
    const slot = daySlots[idx];
    if (slot.status !== 'free') {
      Alert.alert('Slot Occupied', `This slot is currently ${slot.status.toUpperCase()}. Please choose an available green slot.`);
      return;
    }
    setSelectedSlotIndex(idx);
    setModalVisible(true);
  };

  const handleBookNow = async () => {
    if (!selectedRange) return;
    setSubmitting(true);
    try {
      const res = await bookCourt({
        date: currentDateStr,
        start: selectedRange.start,
        end: selectedRange.end,
        court: selectedCourt,
        event: eventTitle,
        pax,
      });

      if (res.success) {
        Alert.alert('Booking Confirmed!', res.message, [
          { text: 'View Bookings', onPress: () => onNavigateToBookings && onNavigateToBookings() },
          { text: 'OK' },
        ]);
        setModalVisible(false);
        fetchGrid(selectedCourt, selectedWeek, true);
      } else {
        Alert.alert('Booking Notice', res.message);
      }
    } catch (err: any) {
      Alert.alert('Booking Failed', err?.message || 'Server error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleScheduleSnipe = async () => {
    if (!selectedRange) return;
    setSubmitting(true);
    try {
      const res = await scheduleSnipe({
        date: currentDateStr,
        start: selectedRange.start,
        end: selectedRange.end,
        court: selectedCourt,
        event: eventTitle,
        pax,
      });

      if (res.success) {
        Alert.alert(
          'Sniper Scheduled!',
          `Auto-Sniper queued for Monday 00:00:00 MYT rollover.\n\nSlot: ${currentDateStr} ${selectedRange.start}-${selectedRange.end} (Court ${selectedCourt})`,
          [
            { text: 'View Sniper Queue', onPress: () => onNavigateToSniper && onNavigateToSniper() },
            { text: 'OK' },
          ]
        );
        setModalVisible(false);
      } else {
        Alert.alert('Scheduling Notice', res.message);
      }
    } catch (err: any) {
      Alert.alert('Scheduling Error', err?.message || 'Server error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Week Selector */}
      <View style={styles.weekToggleContainer}>
        <TouchableOpacity
          style={[styles.weekToggleButton, selectedWeek === 'this' && styles.weekToggleActive]}
          onPress={() => setSelectedWeek('this')}
        >
          <Text style={[styles.weekToggleText, selectedWeek === 'this' && styles.weekToggleTextActive]}>
            This Week (Current)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.weekToggleButton, selectedWeek === 'next' && styles.weekToggleActive]}
          onPress={() => setSelectedWeek('next')}
        >
          <View style={styles.rowCenter}>
            <Text style={[styles.weekToggleText, selectedWeek === 'next' && styles.weekToggleTextActive]}>
              Next Week
            </Text>
            <View style={styles.snipeBadge}>
              <Text style={styles.snipeBadgeText}>SNIPER</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Courts Chips */}
      <View style={styles.courtChipsContainer}>
        {(['1', '2', '3', '4'] as CourtId[]).map((c) => {
          const isSelected = selectedCourt === c;
          return (
            <TouchableOpacity
              key={c}
              style={[styles.courtChip, isSelected && styles.courtChipActive]}
              onPress={() => setSelectedCourt(c)}
            >
              <MaterialCommunityIcons
                name="badminton"
                size={18}
                color={isSelected ? '#ffffff' : '#94a3b8'}
              />
              <Text style={[styles.courtChipText, isSelected && styles.courtChipTextActive]}>
                Court {c}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Day Selector Tabs */}
      <View style={styles.daysScrollContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysScroll}>
          {dates.map((dateStr, idx) => {
            const isSelected = selectedDateIndex === idx;
            const parts = dateStr.split('-');
            const dayNum = parts[0];
            const monthNum = parts[1];
            const isWeekend = idx >= 5;

            return (
              <TouchableOpacity
                key={dateStr}
                style={[styles.dayTab, isSelected && styles.dayTabActive, isWeekend && styles.dayTabWeekend]}
                onPress={() => {
                  setSelectedDateIndex(idx);
                  setSelectedSlotIndex(null);
                }}
              >
                <Text style={[styles.dayTabLabel, isSelected && styles.dayTabLabelActive]}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][idx]}
                </Text>
                <Text style={[styles.dayTabDate, isSelected && styles.dayTabDateActive]}>
                  {dayNum}/{monthNum}
                </Text>
                {isWeekend && <Text style={styles.weekendTag}>Closed</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Grid Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading live court availability...</Text>
        </View>
      ) : (
        <ScrollView style={styles.slotList} contentContainerStyle={styles.slotListContent}>
          <View style={styles.slotListHeader}>
            <Text style={styles.slotListTitle}>
              Gelanggang Badminton {selectedCourt} • {currentDateStr}
            </Text>
            <TouchableOpacity onPress={() => fetchGrid(selectedCourt, selectedWeek, true)}>
              <Ionicons name="refresh" size={18} color="#10b981" />
            </TouchableOpacity>
          </View>

          {daySlots.map((slot) => {
            const isFree = slot.status === 'free';
            const isPending = slot.status === 'pending';
            const isBooked = slot.status === 'booked';
            const isClosed = slot.status === 'closed';

            return (
              <TouchableOpacity
                key={slot.time_start}
                style={[
                  styles.slotRow,
                  isFree && styles.slotRowFree,
                  isPending && styles.slotRowPending,
                  isBooked && styles.slotRowBooked,
                  isClosed && styles.slotRowClosed,
                ]}
                onPress={() => handleSelectSlot(slot.index)}
                activeOpacity={isFree ? 0.7 : 0.9}
              >
                <View style={styles.timeContainer}>
                  <Text style={styles.timeStart}>{slot.time_start}</Text>
                  <Text style={styles.timeEnd}>to {slot.time_end}</Text>
                </View>

                <View style={styles.statusBadgeContainer}>
                  <View
                    style={[
                      styles.statusPill,
                      isFree && styles.statusPillFree,
                      isPending && styles.statusPillPending,
                      isBooked && styles.statusPillBooked,
                      isClosed && styles.statusPillClosed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        isFree && styles.statusPillTextFree,
                        isPending && styles.statusPillTextPending,
                        isBooked && styles.statusPillTextBooked,
                      ]}
                    >
                      {slot.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {isFree ? (
                  <View style={styles.bookActionIcon}>
                    <Text style={styles.selectText}>Select</Text>
                    <Ionicons name="chevron-forward" size={16} color="#10b981" />
                  </View>
                ) : (
                  <View style={styles.bookActionIcon}>
                    <Ionicons
                      name={isPending ? 'hourglass-outline' : isBooked ? 'lock-closed-outline' : 'close-circle-outline'}
                      size={18}
                      color="#64748b"
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Booking Drawer Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {selectedWeek === 'this' ? 'Book Court' : 'Schedule Rollover Sniper'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Gelanggang {selectedCourt} • {currentDateStr}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Time Span Picker */}
            <View style={styles.modalSection}>
              <Text style={styles.inputLabel}>Duration</Text>
              <View style={styles.durationRow}>
                {[
                  { label: '30 min', dur: 1 },
                  { label: '1 hour', dur: 2 },
                  { label: '1.5 hrs', dur: 3 },
                  { label: '2 hours', dur: 4 },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.dur}
                    style={[styles.durationChip, slotDuration === item.dur && styles.durationChipActive]}
                    onPress={() => setSlotDuration(item.dur)}
                  >
                    <Text style={[styles.durationChipText, slotDuration === item.dur && styles.durationChipTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Selected Range Display */}
            {selectedRange && (
              <View style={styles.selectedTimeBox}>
                <Ionicons name="time-outline" size={20} color="#10b981" />
                <Text style={styles.selectedTimeText}>
                  {selectedRange.start} – {selectedRange.end}
                </Text>
                {!selectedRange.isValid && (
                  <Text style={styles.invalidRangeWarn}>⚠️ Some slots in range are occupied</Text>
                )}
              </View>
            )}

            {/* Pax Selector */}
            <View style={styles.modalSection}>
              <Text style={styles.inputLabel}>Participants (Pax: Max 4)</Text>
              <View style={styles.paxRow}>
                {[1, 2, 3, 4].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.paxBtn, pax === n && styles.paxBtnActive]}
                    onPress={() => setPax(n)}
                  >
                    <Text style={[styles.paxBtnText, pax === n && styles.paxBtnTextActive]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Event Name */}
            <View style={styles.modalSection}>
              <Text style={styles.inputLabel}>Event / Booking Purpose</Text>
              <TextInput
                style={styles.textInput}
                value={eventTitle}
                onChangeText={setEventTitle}
                placeholder="Badminton practice"
                placeholderTextColor="#64748b"
              />
            </View>

            {/* Action Buttons */}
            {selectedWeek === 'this' ? (
              <TouchableOpacity
                style={[styles.submitButton, (!selectedRange?.isValid || submitting) && styles.submitButtonDisabled]}
                onPress={handleBookNow}
                disabled={!selectedRange?.isValid || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.submitButtonText}>Confirm & Book Now</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.snipeButton, (!selectedRange?.isValid || submitting) && styles.submitButtonDisabled]}
                onPress={handleScheduleSnipe}
                disabled={!selectedRange?.isValid || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="target" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.submitButtonText}>Queue for Mon 00:00 Rollover</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  weekToggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#131b2e',
    borderRadius: 12,
    padding: 4,
  },
  weekToggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  weekToggleActive: {
    backgroundColor: '#1e293b',
  },
  weekToggleText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  weekToggleTextActive: {
    color: '#f8fafc',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  snipeBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  snipeBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  courtChipsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  courtChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#131b2e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 6,
  },
  courtChipActive: {
    backgroundColor: '#065f46',
    borderColor: '#10b981',
  },
  courtChipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  courtChipTextActive: {
    color: '#ffffff',
  },
  daysScrollContainer: {
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 10,
  },
  daysScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  dayTab: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#131b2e',
    minWidth: 64,
  },
  dayTabActive: {
    backgroundColor: '#2563eb',
  },
  dayTabWeekend: {
    opacity: 0.6,
  },
  dayTabLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dayTabLabelActive: {
    color: '#ffffff',
  },
  dayTabDate: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  dayTabDateActive: {
    color: '#ffffff',
  },
  weekendTag: {
    color: '#ef4444',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
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
  slotList: {
    flex: 1,
  },
  slotListContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 10,
  },
  slotListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  slotListTitle: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131b2e',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  slotRowFree: {
    borderColor: '#064e3b',
    backgroundColor: '#09251e',
  },
  slotRowPending: {
    borderColor: '#78350f',
    backgroundColor: '#241b09',
  },
  slotRowBooked: {
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    opacity: 0.8,
  },
  slotRowClosed: {
    borderColor: '#1e293b',
    backgroundColor: '#0a0f1d',
    opacity: 0.5,
  },
  timeContainer: {
    width: 110,
  },
  timeStart: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  timeEnd: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  statusBadgeContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  statusPillFree: {
    backgroundColor: '#065f46',
  },
  statusPillPending: {
    backgroundColor: '#854d0e',
  },
  statusPillBooked: {
    backgroundColor: '#334155',
  },
  statusPillClosed: {
    backgroundColor: '#1e293b',
  },
  statusPillText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  statusPillTextFree: {
    color: '#34d399',
  },
  statusPillTextPending: {
    color: '#fef08a',
  },
  statusPillTextBooked: {
    color: '#cbd5e1',
  },
  bookActionIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: '#1f2937',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#f9fafb',
    fontSize: 20,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSection: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  durationChipActive: {
    backgroundColor: '#065f46',
    borderColor: '#10b981',
  },
  durationChipText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  durationChipTextActive: {
    color: '#ffffff',
  },
  selectedTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  selectedTimeText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '700',
  },
  invalidRangeWarn: {
    color: '#ef4444',
    fontSize: 11,
    marginLeft: 'auto',
  },
  paxRow: {
    flexDirection: 'row',
    gap: 12,
  },
  paxBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  paxBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  paxBtnText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '700',
  },
  paxBtnTextActive: {
    color: '#ffffff',
  },
  textInput: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    color: '#f9fafb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 15,
    marginTop: 10,
  },
  snipeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 15,
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
