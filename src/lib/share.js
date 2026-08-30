import { Linking, Share } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import RNShare from 'react-native-share';
import RNFS from 'react-native-fs';
import RNHTMLtoPDF from 'react-native-html-to-pdf';

/* Opens a URL (wa.me, mailto:, tel:) the way the web app's openLink()
   tried window.open then an <a> click — here Linking is the one path. */
export async function openLink(url) {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export function toWhatsAppUrl(phoneDigitsOnly, text) {
  return `https://wa.me/${phoneDigitsOnly || ''}?text=${encodeURIComponent(text)}`;
}

export function toMailtoUrl(email, subject, body) {
  return `mailto:${encodeURIComponent(email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/* The system share sheet, for plain text — equivalent of navigator.share. */
export async function nativeShareText(title, message) {
  try {
    const res = await Share.share({ title, message }, { subject: title });
    return res.action !== Share.dismissedAction;
  } catch {
    return false;
  }
}

export async function copyText(text) {
  try {
    Clipboard.setString(text);
    return true;
  } catch {
    return false;
  }
}

/* Renders the report's HTML (see src/lib/report.js#buildReportHTML) to a
   real on-device PDF, then hands it to the native share sheet — this is
   the RN replacement for the old browser "Save as PDF" print dialog. */
export async function shareReportPdf(html, fileName = 'vitals-report') {
  try {
    const pdf = await RNHTMLtoPDF.convert({ html, fileName, base64: false, padding: 0 });
    await RNShare.open({ url: `file://${pdf.filePath}`, type: 'application/pdf', failOnCancel: false });
    return true;
  } catch {
    return false;
  }
}

/* Writes the raw JSON backup to a cache file and hands it to the share
   sheet, so the user can save it into Files / Drive / send it on. */
export async function exportJson(data, fileName) {
  try {
    const name = fileName || `vitals-data-${new Date().toISOString().slice(0, 10)}.json`;
    const path = `${RNFS.CachesDirectoryPath}/${name}`;
    await RNFS.writeFile(path, JSON.stringify(data, null, 2), 'utf8');
    await RNShare.open({ url: `file://${path}`, type: 'application/json', failOnCancel: false });
    return true;
  } catch {
    return false;
  }
}
