import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  AndroidAudioTypePresets,
  AudioSession,
  LiveKitRoom,
  registerGlobals,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from '@livekit/react-native';
import { AudioPresets, RoomEvent } from 'livekit-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Zeroconf from 'react-native-zeroconf';
import {
  startWalkieForegroundService,
  stopWalkieForegroundService,
} from './foregroundService';

registerGlobals();

const SERVER_KEY = 'walkie.serverIp';

export default function App() {
  const [serverIp, setServerIp] = useState(null);
  const [loadingServer, setLoadingServer] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(SERVER_KEY)
      .then((v) => setServerIp(v))
      .finally(() => setLoadingServer(false));
  }, []);

  if (loadingServer) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!serverIp) {
    return <ServerSetupScreen onSave={async (ip) => {
      await AsyncStorage.setItem(SERVER_KEY, ip);
      setServerIp(ip);
    }} />;
  }

  if (!session) {
    return (
      <EntryScreen
        serverIp={serverIp}
        onJoin={setSession}
        onChangeServer={async () => {
          await AsyncStorage.removeItem(SERVER_KEY);
          setServerIp(null);
        }}
      />
    );
  }

  return (
    <RoomScreen
      serverIp={serverIp}
      token={session.token}
      userName={session.userName}
      roomName={session.roomName}
      onLeave={() => setSession(null)}
    />
  );
}

function ServerSetupScreen({ onSave }) {
  const [mode, setMode] = useState('discover');
  const [ip, setIp] = useState('');
  const [saving, setSaving] = useState(false);
  const [servers, setServers] = useState([]);
  const [scanning, setScanning] = useState(false);
  const zeroconfRef = useRef(null);

  useEffect(() => {
    if (mode !== 'discover') return;
    let cancelled = false;
    setServers([]);
    setScanning(true);

    const subnets = ['192.168.0', '192.168.1', '192.168.2', '192.168.3', '10.0.0', '10.0.1'];
    const probeIp = async (ip) => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 1500);
        const res = await fetch(`http://${ip}:3001/ping`, { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) return null;
        return ip;
      } catch {
        return null;
      }
    };

    const BATCH = 32;
    (async () => {
      for (const subnet of subnets) {
        for (let start = 1; start <= 254; start += BATCH) {
          if (cancelled) return;
          const probes = [];
          for (let i = start; i < start + BATCH && i <= 254; i++) {
            probes.push(probeIp(`${subnet}.${i}`));
          }
          const found = (await Promise.all(probes)).filter(Boolean);
          if (cancelled) return;
          if (found.length > 0) {
            setServers((prev) => {
              const next = [...prev];
              for (const host of found) {
                if (!next.some((s) => s.host === host)) {
                  next.push({ name: `Servidor ${host}`, host });
                }
              }
              return next;
            });
          }
        }
      }
      if (!cancelled) setScanning(false);
    })();

    return () => { cancelled = true; };
  }, [mode]);

  const tryConnect = async (host) => {
    setSaving(true);
    try {
      const res = await fetch(`http://${host}:3001/ping`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await onSave(host);
    } catch (err) {
      Alert.alert('Não consegui conectar', `${host}\n\n${err.message}`);
      setSaving(false);
    }
  };

  if (mode === 'manual') {
    return (
      <View style={styles.entryContainer}>
        <StatusBar style="dark" />
        <Text style={styles.title}>Walk-Talk</Text>
        <Text style={styles.subtitle}>Digite o IP do servidor</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 192.168.1.50"
          value={ip}
          onChangeText={setIp}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          editable={!saving}
        />
        <Pressable
          style={[styles.primaryButton, saving && styles.buttonDisabled]}
          onPress={() => {
            const v = ip.trim();
            if (!v) { Alert.alert('Digite o IP'); return; }
            tryConnect(v);
          }}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>CONECTAR</Text>}
        </Pressable>
        <Pressable onPress={() => setMode('discover')} disabled={saving}>
          <Text style={styles.linkButton}>← procurar automaticamente</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.entryContainer}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Walk-Talk</Text>
      <Text style={styles.subtitle}>
        {scanning ? 'Procurando servidores na rede...' : 'Servidores encontrados'}
      </Text>

      {scanning && servers.length === 0 ? (
        <ActivityIndicator style={{ marginVertical: 24 }} />
      ) : null}

      <View style={{ width: '100%' }}>
        {servers.map((s) => (
          <Pressable
            key={s.host}
            style={[styles.serverItem, saving && styles.buttonDisabled]}
            onPress={() => tryConnect(s.host)}
            disabled={saving}
          >
            <Text style={styles.serverItemName}>{s.name}</Text>
            <Text style={styles.serverItemHost}>{s.host}</Text>
          </Pressable>
        ))}
      </View>

      {!scanning && servers.length === 0 ? (
        <Text style={styles.hint}>Nenhum servidor encontrado na rede.</Text>
      ) : null}

      {!scanning ? (
        <Pressable
          style={[styles.secondaryButton, saving && styles.buttonDisabled]}
          onPress={() => setMode('discover')}
          disabled={saving}
        >
          <Text style={styles.secondaryButtonText}>PROCURAR DE NOVO</Text>
        </Pressable>
      ) : null}

      <Pressable onPress={() => setMode('manual')} disabled={saving}>
        <Text style={styles.linkButton}>digitar IP manualmente</Text>
      </Pressable>
    </View>
  );
}

const ROOMS = [
  { name: 'SALA 1', color: '#2563eb', border: '#1d4ed8' },
  { name: 'SALA 2', color: '#dc2626', border: '#991b1b' },
  { name: 'SALA 3', color: '#16a34a', border: '#15803d' },
  { name: 'SALA 4', color: '#d97706', border: '#b45309' },
];

function EntryScreen({ serverIp, onJoin, onChangeServer }) {
  const [userName, setUserName] = useState('');
  const [loadingRoom, setLoadingRoom] = useState(null);
  const backendUrl = `http://${serverIp}:3001`;

  const handleJoin = async (room) => {
    const name = userName.trim();
    if (!name) {
      Alert.alert('Digite seu nome', 'Precisa de um nome para entrar.');
      return;
    }

    setLoadingRoom(room);
    try {
      const res = await fetch(`${backendUrl}/join-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: name, roomName: room }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      onJoin({ token: data.token, userName: name, roomName: room });
    } catch (err) {
      Alert.alert('Não consegui entrar', `${err.message}\n\nVerifique se o servidor (${serverIp}) está ligado e se o celular está na mesma Wi-Fi.`);
    } finally {
      setLoadingRoom(null);
    }
  };

  const busy = loadingRoom !== null;
  const handleRoomPress = (room) => {
    Keyboard.dismiss();
    handleJoin(room);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.entryScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StatusBar style="dark" />
        <Text style={styles.title}>Walk-Talk</Text>
        <Text style={styles.subtitle}>Comunicação em grupo para equipes de evento</Text>

        <TextInput
          style={styles.input}
          placeholder="Seu nome"
          value={userName}
          onChangeText={setUserName}
          autoCapitalize="words"
          editable={!busy}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
        />

        <View style={styles.serverRow}>
          <Text style={styles.serverInfo}>servidor: {serverIp}</Text>
          <Pressable onPress={onChangeServer} disabled={busy}>
            <Text style={styles.serverChange}>trocar</Text>
          </Pressable>
        </View>

        <Text style={styles.roomsLabel}>Escolha a sala</Text>
        <View style={styles.roomsGrid}>
          {ROOMS.map(({ name, color, border }) => {
            const isLoading = loadingRoom === name;
            return (
              <Pressable
                key={name}
                style={[
                  styles.roomButton,
                  { backgroundColor: color, borderColor: border },
                  busy && !isLoading && styles.buttonDisabled,
                ]}
                onPress={() => handleRoomPress(name)}
                disabled={busy}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.roomButtonText}>{name}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RoomScreen({ serverIp, token, userName, roomName, onLeave }) {
  const livekitUrl = `ws://${serverIp}:7880`;
  useEffect(() => {
    AudioSession.startAudioSession();
    AudioSession.configureAudio({
      android: {
        preferredOutputList: ['bluetooth', 'headset', 'speaker', 'earpiece'],
        audioTypeOptions: AndroidAudioTypePresets.media,
      },
    }).catch((err) => console.warn('configureAudio falhou', err));
    startWalkieForegroundService(roomName).catch((err) =>
      console.warn('foreground service start falhou', err)
    );
    return () => {
      AudioSession.stopAudioSession();
      stopWalkieForegroundService().catch((err) =>
        console.warn('foreground service stop falhou', err)
      );
    };
  }, [roomName]);

  return (
    <LiveKitRoom
      serverUrl={livekitUrl}
      token={token}
      connect={true}
      audio={true}
      video={false}
      options={{
        adaptiveStream: { pixelDensity: 'screen' },
        publishDefaults: { audioPreset: AudioPresets.musicHighQuality },
      }}
    >
      <RoomUI userName={userName} roomName={roomName} onLeave={onLeave} />
    </LiveKitRoom>
  );
}

function RoomUI({ userName, roomName, onLeave }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const participants = useParticipants();
  const [tab, setTab] = useState('participants');

  const muted = !isMicrophoneEnabled;

  const toggleMute = async () => {
    if (!localParticipant) return;
    await localParticipant.setMicrophoneEnabled(muted);
  };

  return (
    <KeyboardAvoidingView
      style={styles.roomContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <View style={styles.roomHeader}>
        <Text style={styles.roomName}>{roomName}</Text>
        <Text style={styles.roomUser}>você: {userName}</Text>
      </View>

      <View style={styles.tabsRow}>
        <Pressable
          style={[styles.tab, tab === 'participants' && styles.tabActive]}
          onPress={() => setTab('participants')}
        >
          <Text style={[styles.tabText, tab === 'participants' && styles.tabTextActive]}>
            Participantes ({participants.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'chat' && styles.tabActive]}
          onPress={() => setTab('chat')}
        >
          <Text style={[styles.tabText, tab === 'chat' && styles.tabTextActive]}>
            Chat
          </Text>
        </Pressable>
      </View>

      <View style={styles.tabContent}>
        {tab === 'participants' ? (
          <ParticipantsList participants={participants} />
        ) : (
          <ChatPanel />
        )}
      </View>

      <View style={styles.controls}>
        <Pressable
          style={[styles.muteButton, muted && styles.muteButtonActive]}
          onPress={toggleMute}
        >
          <Text style={styles.muteButtonText}>
            {muted ? 'MUDO' : 'FALANDO'}
          </Text>
          <Text style={styles.muteHint}>
            Toque para {muted ? 'desmutar' : 'mutar'}
          </Text>
        </Pressable>

        <Pressable style={styles.leaveButton} onPress={onLeave}>
          <Text style={styles.leaveButtonText}>Sair da sala</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function ParticipantsList({ participants }) {
  return (
    <View style={styles.panel}>
      {participants.map((p) => (
        <Text key={p.identity} style={styles.participantItem}>
          {p.isLocal ? `${p.identity} (você)` : p.identity}
          {p.isSpeaking ? '  🔊' : ''}
        </Text>
      ))}
    </View>
  );
}

function ChatPanel() {
  const room = useRoomContext();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (!room) return;
    const handler = (msg, participant) => {
      setMessages((prev) => [
        ...prev,
        {
          id: msg.id ?? `${Date.now()}-${Math.random()}`,
          text: msg.message,
          from: participant?.identity ?? 'desconhecido',
          isLocal: participant?.isLocal ?? false,
          at: msg.timestamp ?? Date.now(),
        },
      ]);
    };
    room.on(RoomEvent.ChatMessage, handler);
    return () => {
      room.off(RoomEvent.ChatMessage, handler);
    };
  }, [room]);

  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !room || sending) return;
    setSending(true);
    try {
      await room.localParticipant.sendChatMessage(text);
      setDraft('');
    } catch (err) {
      Alert.alert('Erro ao enviar', err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.panel}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.chatBubble, item.isLocal && styles.chatBubbleLocal]}>
            <Text style={styles.chatFrom}>
              {item.isLocal ? 'você' : item.from}
            </Text>
            <Text style={styles.chatText}>{item.text}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.chatEmpty}>Sem mensagens ainda.</Text>
        }
        contentContainerStyle={messages.length === 0 && styles.chatEmptyContainer}
      />
      <View style={styles.chatInputRow}>
        <TextInput
          style={styles.chatInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Mensagem..."
          placeholderTextColor="#666"
          onSubmitEditing={send}
          returnKeyType="send"
          editable={!sending}
        />
        <Pressable
          style={[styles.chatSend, (!draft.trim() || sending) && styles.buttonDisabled]}
          onPress={send}
          disabled={!draft.trim() || sending}
        >
          <Text style={styles.chatSendText}>
            {sending ? '...' : 'Enviar'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  entryContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  entryScroll: {
    flexGrow: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    paddingTop: 48,
    paddingBottom: 48,
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 48,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  roomsLabel: {
    alignSelf: 'flex-start',
    color: '#666',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 12,
  },
  center: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  hint: {
    marginTop: 24,
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  serverRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  serverInfo: {
    color: '#888',
    fontSize: 12,
  },
  serverChange: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '600',
  },
  serverItem: {
    width: '100%',
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#fafafa',
    marginBottom: 8,
  },
  serverItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  serverItemHost: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    marginTop: 16,
  },
  secondaryButtonText: {
    color: '#2563eb',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1,
  },
  linkButton: {
    color: '#2563eb',
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
  },
  roomsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  roomButton: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 2,
    paddingVertical: 28,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  roomButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  roomContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 24,
    paddingTop: 60,
  },
  roomHeader: { marginBottom: 32 },
  roomName: { color: '#fff', fontSize: 28, fontWeight: '700' },
  roomUser: { color: '#888', fontSize: 14, marginTop: 4 },
  tabsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#3b3b3b',
  },
  tabText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabContent: {
    flex: 1,
  },
  panel: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
  },
  participantItem: {
    color: '#fff',
    fontSize: 16,
    paddingVertical: 6,
  },
  chatBubble: {
    backgroundColor: '#3b3b3b',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  chatBubbleLocal: {
    backgroundColor: '#2563eb',
    alignSelf: 'flex-end',
  },
  chatFrom: {
    color: '#aaa',
    fontSize: 11,
    marginBottom: 2,
  },
  chatText: {
    color: '#fff',
    fontSize: 15,
  },
  chatEmpty: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
  },
  chatEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    fontSize: 15,
  },
  chatSend: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  chatSendText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  controls: { marginTop: 24 },
  muteButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  muteButtonActive: { backgroundColor: '#ef4444' },
  muteButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
  },
  muteHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  leaveButton: {
    paddingVertical: 18,
    paddingBottom: 32,
    alignItems: 'center',
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
  },
  leaveButtonText: {
    color: '#ddd',
    fontSize: 16,
    fontWeight: '600',
  },
});
