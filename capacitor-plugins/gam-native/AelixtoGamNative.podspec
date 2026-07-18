require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = 'AelixtoGamNative'
  s.version      = package['version']
  s.summary      = package['description']
  s.license      = 'MIT'
  s.homepage     = 'https://aelixto.com'
  s.author       = 'Aelixto'
  s.source       = { :git => 'https://aelixto.com', :tag => s.version.to_s }
  s.source_files = 'ios/Plugin/**/*.{swift,h,m}'
  s.ios.deployment_target = '13.0'
  s.dependency 'Capacitor'
  s.dependency 'Google-Mobile-Ads-SDK', '~> 11.10'
  s.dependency 'GoogleUserMessagingPlatform', '~> 2.6'
  s.swift_version = '5.1'
end