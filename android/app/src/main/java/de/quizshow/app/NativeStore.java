package de.quizshow.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.JavascriptInterface;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Persistent storage for the web part, exposed to JavaScript as
 * {@code window.QuizshowNative} (see src/js/data/native.js).
 *
 * <ul>
 *   <li>Items (settings, statistics, highscores, library list – small JSON values)
 *       live in the SharedPreferences file {@code quizshow.xml}.</li>
 *   <li>Data (imported catalogs incl. images) are stored as files in
 *       {@code files/catalogs/}.</li>
 * </ul>
 * Both are part of Android's backup (res/xml/backup_rules.xml) and survive a
 * reset of the WebView data. Methods are called on a WebView background thread.
 */
final class NativeStore {
    private final SharedPreferences prefs;
    private final File dataDir;

    NativeStore(Context context) {
        prefs = context.getSharedPreferences("quizshow", Context.MODE_PRIVATE);
        dataDir = new File(context.getFilesDir(), "catalogs");
    }

    @JavascriptInterface
    public String getItem(String key) {
        return prefs.getString(key, null);
    }

    @JavascriptInterface
    public boolean setItem(String key, String value) {
        return prefs.edit().putString(key, value).commit();
    }

    @JavascriptInterface
    public void removeItem(String key) {
        prefs.edit().remove(key).commit();
    }

    @JavascriptInterface
    public synchronized String readData(String key) {
        File file = fileFor(key);
        if (!file.isFile()) return null;
        try (InputStream in = new FileInputStream(file)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream((int) Math.min(file.length(), Integer.MAX_VALUE));
            byte[] buffer = new byte[64 * 1024];
            int n;
            while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            return null;
        }
    }

    /** Writes to a temporary file first, so a crash never leaves a half-written catalog. */
    @JavascriptInterface
    public synchronized boolean writeData(String key, String value) {
        if (!dataDir.isDirectory() && !dataDir.mkdirs()) return false;
        File file = fileFor(key);
        File tmp = new File(dataDir, file.getName() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(value.getBytes(StandardCharsets.UTF_8));
            out.getFD().sync();
        } catch (IOException e) {
            tmp.delete();
            return false;
        }
        return tmp.renameTo(file);
    }

    @JavascriptInterface
    public synchronized void deleteData(String key) {
        fileFor(key).delete();
    }

    /** Keys are arbitrary strings (catalog ids) → hex-encoded file names. */
    private File fileFor(String key) {
        StringBuilder name = new StringBuilder();
        for (byte b : key.getBytes(StandardCharsets.UTF_8)) name.append(String.format("%02x", b & 0xff));
        return new File(dataDir, name + ".json");
    }
}
