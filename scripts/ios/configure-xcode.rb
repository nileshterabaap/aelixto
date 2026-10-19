# Idempotent Xcode project setup for Aelixto (run on macOS / Codemagic):
#   gem install xcodeproj && ruby scripts/ios/configure-xcode.rb
# - attaches App.entitlements + PrivacyInfo.xcprivacy to the App target
# - creates the ShareExtension target (com.aelixto.app10.ShareExtension)
#   and embeds it in the app.
require 'xcodeproj'

root = File.expand_path('../../ios/App', __dir__)
project = Xcodeproj::Project.open(File.join(root, 'App.xcodeproj'))
app = project.targets.find { |t| t.name == 'App' } or abort('App target missing')

app.build_configurations.each do |c|
  c.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
  c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
  c.build_settings['TARGETED_DEVICE_FAMILY'] = '1'
end

app_group = project.main_group.find_subpath('App', false)
unless app_group.files.any? { |f| f.path == 'PrivacyInfo.xcprivacy' }
  ref = app_group.new_reference('PrivacyInfo.xcprivacy')
  app.resources_build_phase.add_file_reference(ref)
end
unless app_group.files.any? { |f| f.path == 'App.entitlements' }
  app_group.new_reference('App.entitlements')
end

unless project.targets.any? { |t| t.name == 'ShareExtension' }
  ext = project.new_target(:app_extension, 'ShareExtension', :ios, '15.0')
  group = project.main_group.find_subpath('ShareExtension', true)
  group.set_source_tree('<group>')
  group.set_path('ShareExtension')
  swift = group.new_reference('ShareViewController.swift')
  group.new_reference('Info.plist')
  group.new_reference('ShareExtension.entitlements')
  ext.source_build_phase.add_file_reference(swift)

  ext.build_configurations.each do |c|
    s = c.build_settings
    s['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.aelixto.app10.ShareExtension'
    s['INFOPLIST_FILE'] = 'ShareExtension/Info.plist'
    s['CODE_SIGN_ENTITLEMENTS'] = 'ShareExtension/ShareExtension.entitlements'
    s['SWIFT_VERSION'] = '5.0'
    s['TARGETED_DEVICE_FAMILY'] = '1'
    s['MARKETING_VERSION'] = app.build_configurations.first.build_settings['MARKETING_VERSION'] || '1.0'
    s['CURRENT_PROJECT_VERSION'] = app.build_configurations.first.build_settings['CURRENT_PROJECT_VERSION'] || '1'
    s['SKIP_INSTALL'] = 'YES'
    s['LD_RUNPATH_SEARCH_PATHS'] = '$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks'
  end

  embed = app.new_copy_files_build_phase('Embed Foundation Extensions')
  embed.dst_subfolder_spec = '13' # PlugIns
  bf = embed.add_file_reference(ext.product_reference, true)
  bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
  app.add_dependency(ext)
end

project.save
puts '[configure-xcode] done'
