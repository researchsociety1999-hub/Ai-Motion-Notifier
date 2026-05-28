import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  TouchableOpacity, SafeAreaView, ScrollView,
} from 'react-native';
import { API_URL } from '../config';

export default function SettingsScreen() {
  const [apiUrl, setApiUrl] = useState(API_URL);
  const [healthStatus, setHealthStatus] = useState(null);
  const [checking, setChecking] = useState(false);

  const checkHealth = async () => {
    setChecking(true);
    setHealthStatus(null);
    try {
      const res = await fetch(`${apiUrl}/health`);
      const data = await res.json();
      setHealthStatus({ ok: true, uptime: Math.round(data.uptime) });
    } catch (err) {
      setHealthStatus({ ok: false, error: err.message });
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backend Connection</Text>
          <Text style={styles.label}>Fly.io App URL</Text>
          <TextInput
            style={styles.input}
            value={apiUrl}
            onChangeText={setApiUrl}
            placeholder="https://your-app.fly.dev"
            placeholderTextColor="#475569"
            autoCapitalize="none"
            keyboardType="url"
          />
          <TouchableOpacity style={styles.button} onPress={checkHealth} disabled={checking}>
            <Text style={styles.buttonText}>{checking ? 'Checking...' : 'Test Connection'}</Text>
          </TouchableOpacity>
          {healthStatus && (
            <View style={[styles.status, { borderColor: healthStatus.ok ? '#22c55e' : '#ef4444' }]}>
              <Text style={{ color: healthStatus.ok ? '#22c55e' : '#ef4444', fontSize: 14 }}>
                {healthStatus.ok
                  ? `✅ Connected — uptime ${healthStatus.uptime}s`
                  : `❌ Failed: ${healthStatus.error}`}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Text style={styles.infoText}>Topic: <Text style={styles.code}>ring-motion-alerts</Text></Text>
          <Text style={styles.infoText}>Subscribed automatically on first launch after granting permission.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Priority Guide</Text>
          {[
            { label: '🔴 High',   desc: 'Person detected at night (10pm–6am)' },
            { label: '🟠 Medium', desc: 'Person or vehicle during the day' },
            { label: '🔵 Low',    desc: 'Package detected' },
            { label: '⚫ Silent', desc: 'Animal or low-confidence detection' },
          ].map(item => (
            <View key={item.label} style={styles.guideRow}>
              <Text style={styles.guideLabel}>{item.label}</Text>
              <Text style={styles.guideDesc}>{item.desc}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, gap: 20 },
  section: { backgroundColor: '#1e293b', borderRadius: 14, padding: 18, gap: 12 },
  sectionTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: '500' },
  input: { backgroundColor: '#0f172a', color: '#e2e8f0', borderRadius: 10, padding: 14, fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  button: { backgroundColor: '#3b82f6', borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  status: { borderRadius: 10, padding: 12, borderWidth: 1 },
  infoText: { color: '#94a3b8', fontSize: 14, lineHeight: 22 },
  code: { color: '#38bdf8', fontFamily: 'monospace' },
  guideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  guideLabel: { color: '#e2e8f0', fontSize: 13, fontWeight: '600', width: 90 },
  guideDesc: { color: '#94a3b8', fontSize: 13, flex: 1, lineHeight: 20 },
});
