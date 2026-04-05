import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import htmlContent from './htmlContent';

export default function App() {
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.webContainer}>
        <View style={styles.webCard}>
          <Text style={styles.title}>BetTracker Pro</Text>
          <Text style={styles.subtitle}>
            Web preview ke liye GitHub Pages wali docs/index.html file use karo.
            Native Android/iPhone app ke liye ye Expo wrapper ready hai.
          </Text>
        </View>
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent, baseUrl: 'https://localhost' }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        allowsInlineMediaPlayback
        allowsBackForwardNavigationGestures
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#0a84ff" />
            <Text style={styles.loaderText}>BetTracker Pro load ho raha hai...</Text>
          </View>
        )}
      />
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loader: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#050816',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  webCard: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 16,
    lineHeight: 24,
  },
});
