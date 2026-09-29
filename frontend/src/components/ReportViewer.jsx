import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, NativeModules, PixelRatio, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';
import RNFS from 'react-native-fs';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme/colors';
import { SANS, MONO } from '../theme/typography';
import { sizeLabel } from '../lib/attachments';
import Press from './atoms/Press';

/* Opens a record's report inside the app instead of handing it to a
   browser. The file is fetched through the same 5-minute link as before
   (never through an outside viewer — it's a health report):

     photo — shown in a WebView, which gives pinch-to-zoom for free
     PDF   — Android's WebView can't show PDFs, so it's downloaded to the
             app's private cache, each page is rendered to an image by
             the platform PdfRenderer (android/.../pdf/PdfPagesModule.kt)
             and the pages are shown as one zoomable, scrolling document

   Everything written to the cache is deleted when the viewer closes. */

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const page = body => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=6, user-scalable=yes">
<style>
  html, body { margin: 0; background: #1b1f1d; }
  body { padding: 12px 0 28px; }
  img { display: block; width: 100%; height: auto; }
  .pdf img { width: calc(100% - 20px); margin: 0 auto 10px; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.5); }
  .photo { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 0; }
  .note { color: #b9c2bd; font: 13px sans-serif; text-align: center; margin: 6px 16px 16px; }
</style></head><body>${body}</body></html>`;

export default function ReportViewer({ record, getUrl, onClose }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [state, setState] = useState({ phase: 'loading', text: 'Opening report…' });
  const [attempt, setAttempt] = useState(0);
  const workDir = useRef(null);
  const file = record?.attachment;
  const isPdf = file?.type === 'application/pdf';
  const recordId = file ? record.id : null;
  /* getUrl and the screen width are read through a ref: getUrl is a fresh
     function on every app render, and loading must run once per open —
     not restart the download each time anything else in the app updates. */
  const latest = useRef({ getUrl, width });
  latest.current = { getUrl, width };

  const cleanUp = useCallback(() => {
    const dir = workDir.current;
    workDir.current = null;
    if (dir) RNFS.unlink(dir).catch(() => {});
  }, []);

  useEffect(() => {
    if (!recordId) return undefined;
    let cancelled = false;
    const set = s => !cancelled && setState(s);

    (async () => {
      try {
        set({ phase: 'loading', text: 'Opening report…' });
        const url = await latest.current.getUrl(recordId);
        if (cancelled) return;

        if (!isPdf) {
          set({ phase: 'ready', html: page(`<div class="photo"><img src="${esc(url)}" alt="" onerror="window.ReactNativeWebView.postMessage('img-error')"></div>`) });
          return;
        }

        // anything left from a viewer the app was killed in — health reports shouldn't linger on the phone
        await RNFS.unlink(`${RNFS.CachesDirectoryPath}/report-view`).catch(() => {});
        const dir = `${RNFS.CachesDirectoryPath}/report-view/${Date.now()}`;
        workDir.current = dir;
        await RNFS.mkdir(dir);
        const pdfPath = `${dir}/report.pdf`;
        const dl = RNFS.downloadFile({
          fromUrl: url,
          toFile: pdfPath,
          progressInterval: 250,
          progress: p => p.contentLength > 0 && set({ phase: 'loading', text: `Downloading… ${Math.round((p.bytesWritten / p.contentLength) * 100)}%` }),
        });
        const res = await dl.promise;
        if (cancelled) return;
        if (res.statusCode !== 200) throw new Error("The report couldn't be downloaded. Please try again.");

        set({ phase: 'loading', text: 'Preparing pages…' });
        const out = await NativeModules.PdfPages.render(pdfPath, `${dir}/pages`, Math.round(latest.current.width * PixelRatio.get()));
        RNFS.unlink(pdfPath).catch(() => {}); // only the page images are needed from here
        if (cancelled) return;

        const imgs = out.pages.map((p, i) => `<img src="${esc(p.uri)}" alt="Page ${i + 1}" width="${p.width}" height="${p.height}">`).join('');
        const note = `${out.pageCount} page${out.pageCount === 1 ? '' : 's'}${out.truncated ? ` · showing the first ${out.pages.length}` : ''} · pinch to zoom`;
        set({ phase: 'ready', html: page(`<div class="pdf">${imgs}<p class="note">${note}</p></div>`), baseUrl: `file://${dir}/` });
      } catch (err) {
        set({ phase: 'error', text: err?.message || "The report couldn't be opened. Please try again." });
      }
    })();

    return () => {
      cancelled = true;
      cleanUp();
    };
  }, [recordId, isPdf, attempt, cleanUp]);

  if (!record || !file) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1}>
              {file.name}
            </Text>
            <Text style={styles.meta}>
              {isPdf ? 'PDF' : 'Photo'} · {sizeLabel(file.size)}
            </Text>
          </View>
          <Press onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close report">
            <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round">
              <Path d="M6 6l12 12M18 6L6 18" />
            </Svg>
          </Press>
        </View>

        {state.phase === 'ready' ? (
          <WebView
            style={styles.web}
            originWhitelist={['*']}
            source={{ html: state.html, baseUrl: state.baseUrl }}
            allowFileAccess
            allowFileAccessFromFileURLs
            setBuiltInZoomControls
            setDisplayZoomControls={false}
            onMessage={e => e.nativeEvent.data === 'img-error' && setState({ phase: 'error', text: "The photo couldn't be loaded. Please try again." })}
          />
        ) : (
          <View style={styles.center}>
            {state.phase === 'loading' ? (
              <>
                <ActivityIndicator color="#FFFFFF" size="large" />
                <Text style={styles.status}>{state.text}</Text>
              </>
            ) : (
              <>
                <Text style={styles.errorText}>{state.text}</Text>
                <Press onPress={() => setAttempt(a => a + 1)} style={styles.retry}>
                  <Text style={styles.retryLabel}>Try again</Text>
                </Press>
              </>
            )}
          </View>
        )}
        <View style={{ height: insets.bottom, backgroundColor: '#1b1f1d' }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1b1f1d' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  title: { fontFamily: SANS.semibold, fontSize: 16.5, color: '#FFFFFF' },
  meta: { fontFamily: MONO.regular, fontSize: 12.5, letterSpacing: 0.5, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  closeBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  web: { flex: 1, backgroundColor: '#1b1f1d' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  status: { fontFamily: SANS.medium, fontSize: 15, color: 'rgba(255,255,255,0.8)' },
  errorText: { fontFamily: SANS.medium, fontSize: 15.5, color: '#FFFFFF', textAlign: 'center', lineHeight: 22 },
  retry: { backgroundColor: C.brand, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 22 },
  retryLabel: { fontFamily: SANS.semibold, fontSize: 15, color: '#FFFFFF' },
});
