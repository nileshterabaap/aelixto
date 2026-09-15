# Aelixto as a share option (Android + iOS)

The web side is done: a link shared into Aelixto opens the create-post sheet
with the link already filled in and the preview loading.

Two native steps are needed in the generated projects (they are not tracked in
this repo, so apply them after `npx cap sync`).

## Android — `android/app/src/main/AndroidManifest.xml`

Inside the existing `<activity android:name=".MainActivity" ...>` block, add:

```xml
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
</intent-filter>
```

Keep `android:launchMode="singleTask"` on MainActivity so sharing reuses the
running app instead of starting a second copy.

Note: Android orders the share sheet by its own ranking (usage/direct share).
An app cannot force itself to a fixed position; Aelixto will climb the list as
it is used. Users can also pin it via the share sheet's long-press menu.

## iOS — Share Extension (Xcode)

1. Xcode → File → New → Target → **Share Extension**, name it `ShareExtension`.
2. Set its bundle id to `com.aelixto.app10.ShareExtension` and the same App
   Group as the main app (`group.com.aelixto.app10`).
3. Follow the `send-intent` plugin's iOS setup (ShareViewController + URL
   scheme `aelixto://`) from its README.
4. In `Info.plist` of the extension allow `NSExtensionActivationSupportsWebURLWithMaxCount = 1`.

iOS also ranks the share sheet itself; users can drag Aelixto's icon to the
front in "Edit Actions".
