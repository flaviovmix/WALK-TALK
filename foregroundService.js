import notifee, {
  AndroidImportance,
  AndroidForegroundServiceType,
} from '@notifee/react-native';
import { Platform } from 'react-native';

const CHANNEL_ID = 'walkie-call';

notifee.registerForegroundService(() => {
  return new Promise(() => {});
});

export async function startWalkieForegroundService(roomName) {
  if (Platform.OS !== 'android') return;

  await notifee.requestPermission();

  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Walk-Talk ativo',
    importance: AndroidImportance.DEFAULT,
  });

  await notifee.displayNotification({
    title: 'Walk-Talk ativo',
    body: `Conectado em ${roomName}`,
    android: {
      channelId: CHANNEL_ID,
      asForegroundService: true,
      foregroundServiceTypes: [AndroidForegroundServiceType.MICROPHONE],
      ongoing: true,
      smallIcon: 'ic_launcher',
      pressAction: { id: 'default' },
    },
  });
}

export async function stopWalkieForegroundService() {
  if (Platform.OS !== 'android') return;
  await notifee.stopForegroundService();
}
