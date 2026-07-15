#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(GamNativePlugin, "GamNative",
  CAP_PLUGIN_METHOD(initialize, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(requestConsentInfo, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(showConsentFormIfRequired, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(showPrivacyOptionsForm, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(requestTrackingAuthorization, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(loadNativeAd, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(recordImpression, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(recordClick, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(destroyAd, CAPPluginReturnPromise);
)