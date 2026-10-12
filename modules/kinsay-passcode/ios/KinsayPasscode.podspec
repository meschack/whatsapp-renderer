Pod::Spec.new do |s|
  s.name = 'KinsayPasscode'
  s.version = '1.0.0'
  s.summary = 'Kinsay native background passcode derivation'
  s.description = s.summary
  s.license = 'MIT'
  s.author = 'Kinsay'
  s.homepage = 'https://github.com/meschack/whatsapp-renderer'
  s.source = { git: 'https://github.com/meschack/whatsapp-renderer.git' }
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
