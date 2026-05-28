import React from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Linking, SafeAreaView,
} from 'react-native';
import { CLASSIFICATION_CONFIG, PRIORITY_CONFIG } from '../config';

export default function EventDetailScreen({ route }) {
  const { event } = route.params;
  const cls = CLASSIFICATION_CONFIG[event.ai_classification] || CLASSIFICATION_CONFIG.unknown;
  const pri = PRIORITY_CONFIG[event.notification_priority] || PRIORITY_CONFIG.medium;
  const time = new Date(event.event_timestamp).toLocaleString('en-US', {
    dateStyle: 'full', timeStyle: 'short',
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.heroBadge, { backgroundColor: cls.color + '22', borderColor: cls.color }]}>
          <Text style={styles.heroEmoji}>{cls.emoji}</Text>
          <Text style={[styles.heroLabel, { color: cls.color }]}>{cls.label}</Text>
          {event.ai_confidence > 0 && (
            <Text style={[styles.confidence, { color: cls.color }]}>
              {Math.round(event.ai_confidence * 100)}% confidence
            </Text>
          )}
        </View>

        <Text style={styles.summary}>{event.ai_summary || 'Motion detected'}</Text>

        {event.ai_description ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>AI Description</Text>
            <Text style={styles.sectionText}>{event.ai_description}</Text>
          </View>
        ) : null}

        <View style={styles.grid}>
          <DetailCell label="Camera" value={event.device_id} />
          <DetailCell label="Time" value={time} />
          <DetailCell label="Priority" value={pri.label} valueColor={pri.color} />
          <DetailCell label="Threat Level" value={event.ai_threat_level || 'none'} />
          <DetailCell label="Ring Type" value={event.sub_type || 'unknown'} />
          <DetailCell label="AI Source" value={event.ai_source || 'fallback'} />
        </View>

        {event.clip_url ? (
          <TouchableOpacity
            style={styles.clipButton}
            onPress={() => Linking.openURL(event.clip_url)}
          >
            <Text style={styles.clipButtonText}>▶ View Clip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.noClip}>
            <Text style={styles.noClipText}>No clip available</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailCell({ label, value, valueColor }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, gap: 16 },
  heroBadge: { alignItems: 'center', padding: 20, borderRadius: 16, borderWidth: 1, gap: 4 },
  heroEmoji: { fontSize: 40 },
  heroLabel: { fontSize: 22, fontWeight: '700' },
  confidence: { fontSize: 13, fontWeight: '500', opacity: 0.8 },
  summary: { color: '#e2e8f0', fontSize: 17, lineHeight: 26, textAlign: 'center' },
  section: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, gap: 6 },
  sectionLabel: { color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionText: { color: '#cbd5e1', fontSize: 15, lineHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { backgroundColor: '#1e293b', borderRadius: 10, padding: 14, width: '47%', gap: 4 },
  cellLabel: { color: '#64748b', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  cellValue: { color: '#e2e8f0', fontSize: 14, fontWeight: '500' },
  clipButton: { backgroundColor: '#ef4444', borderRadius: 12, padding: 16, alignItems: 'center' },
  clipButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  noClip: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, alignItems: 'center' },
  noClipText: { color: '#64748b', fontSize: 14 },
});
