import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vkeyboard.mug',
  appName: 'VKeyboard for MUG',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
};

export default config;
