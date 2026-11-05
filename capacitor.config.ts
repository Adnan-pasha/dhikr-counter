import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cognitrixlabs.muneeb',
  appName: 'Muneeb',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      // The white silhouette of the mark in the status bar, tinted with the brand green.
      smallIcon: 'ic_stat_muneeb',
      iconColor: '#0B5A45',
    },
  },
};

export default config;
