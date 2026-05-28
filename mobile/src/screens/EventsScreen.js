import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { fetchEvents } from '../api/events';
import { CLASSIFICATION_CONFIG, PRIORITY_CONFIG } from '../config';

export default function EventsScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadEvents = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchEvents({ limit: 30 });
      setEvents(Array.isArray(data) ? data : data.events || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, []);

  const onRefresh = () => { setRefreshing(true); loadEvents(); };

  const renderEvent = ({ item }) => {
    const cls = CLASSIFICATION_CONFIG[item.ai_classification] || CLASSIFICATION_CONFIG.unknown;
    const pri = PRIORITY_CONFIG[item.notification_priority] || PRIORITY_CONFIG.medium;
    const time = new Date(item.event_timestamp).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('EventDetail', { event: item })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: cls.color + '22', borderColor: cls.color }]}>
            <Text style={[styles.badgeText, { color: cls.color }]}>{cls.emoji} {cls.label}</Text>
          </View>
          <View style={[styles.priorityDot, { backgroundColor: pri.color }]} />
        </View>
        <Text style={styles.summary} numberOfLines={2}>{item.ai_summary || 'Motion detected'}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.meta}>{item.device_id}</Text>
          <Text style={styles.meta}>{time}</Text>
        </View>
        {item.ai_confidence > 0 && (
          <View style={styles.confidenceBar}>
            <View style={[styles.confidenceFill, {
              width: `${Math.round(item.ai_confidence * 100)}%`,
              backgroundColor: cls.color,
            }]} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#ef4444" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={item => String(item.id)}
        renderItem={renderEvent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ef4444" />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>{error || 'No motion events yet'}</Text>
          </View>
        }
        contentContainerStyle={events.length === 0 ? styles.flex : styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  flex: { flex: 1 },
  list: { padding: 16, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#334155' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  summary: { color: '#e2e8f0', fontSize: 15, lineHeight: 22, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { color: '#64748b', fontSize: 12 },
  confidenceBar: { height: 3, backgroundColor: '#334155', borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  confidenceFill: { height: '100%', borderRadius: 2 },
  emptyText: { color: '#64748b', fontSize: 16 },
});
