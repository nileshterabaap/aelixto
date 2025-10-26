# 🔒 Embed Feature Flag System

## Overview
This system allows you to enable/disable specific social media embeds independently, so you can test or fix one platform at a time without affecting others.

## How It Works

### 1. Feature Flags Location
All embed toggles are in: **`src/config/embedFeatureFlags.ts`**

### 2. Current Settings
```typescript
export const EMBED_FEATURE_FLAGS = {
  instagram: true,   // Instagram embeds
  facebook: true,    // Facebook embeds
  twitter: true,     // X/Twitter embeds
  pinterest: true,   // Pinterest embeds
  youtube: true,     // YouTube videos
  tiktok: true,      // TikTok videos
  reddit: true,      // Reddit posts
}
```

### 3. To Disable a Platform
Simply change `true` to `false`:

```typescript
export const EMBED_FEATURE_FLAGS = {
  instagram: false,  // ❌ Instagram disabled - won't render
  facebook: true,    // ✅ Facebook still works
  twitter: true,     // ✅ Twitter still works
  pinterest: false,  // ❌ Pinterest disabled - won't render
  youtube: true,     // ✅ YouTube still works
  tiktok: true,      // ✅ TikTok still works
  reddit: true,      // ✅ Reddit still works
}
```

### 4. What Happens When Disabled
- Posts from disabled platforms show a "🔒 Platform embeds are currently disabled" message
- All other platforms continue working normally
- No code from the disabled platform is executed

## Testing Workflow

### Example: Fix Pinterest Without Breaking Instagram

1. **Disable everything except Pinterest:**
```typescript
export const EMBED_FEATURE_FLAGS = {
  instagram: false,
  facebook: false,
  twitter: false,
  pinterest: true,   // Only this is enabled
  youtube: false,
  tiktok: false,
  reddit: false,
}
```

2. **Test and fix Pinterest** - other platforms are isolated and won't interfere

3. **Once Pinterest works, re-enable everything:**
```typescript
export const EMBED_FEATURE_FLAGS = {
  instagram: true,
  facebook: true,
  twitter: true,
  pinterest: true,   // Now fixed!
  youtube: true,
  tiktok: true,
  reddit: true,
}
```

## Benefits

✅ **Isolated Testing** - Work on one platform without touching others  
✅ **Safe Debugging** - Disable broken embeds while you fix them  
✅ **Modular Control** - Each platform is completely independent  
✅ **Visual Feedback** - Disabled platforms show clear status message  
✅ **Zero Risk** - Working platforms stay untouched during fixes

## Notes

- Changes take effect immediately (hot reload)
- Feature flags only affect rendering, not data storage
- Disabled embeds still appear in the feed with a status message
- This is a development tool - remove in production or use environment variables
