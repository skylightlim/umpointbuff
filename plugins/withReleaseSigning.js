// Signs release builds with the key named in ~/.gradle/gradle.properties (UMPOINT_STORE_FILE,
// UMPOINT_STORE_PASSWORD, UMPOINT_KEY_ALIAS, UMPOINT_KEY_PASSWORD). The key never enters the repo.
// Without those properties the release falls back to the debug key, as Expo's template does.
const { withAppBuildGradle } = require('expo/config-plugins');

const SIGNING = `
        release {
            if (project.hasProperty('UMPOINT_STORE_FILE')) {
                storeFile file(UMPOINT_STORE_FILE)
                storePassword UMPOINT_STORE_PASSWORD
                keyAlias UMPOINT_KEY_ALIAS
                keyPassword UMPOINT_KEY_PASSWORD
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (!gradle.includes('UMPOINT_STORE_FILE')) {
      gradle = gradle.replace(/signingConfigs \{/, (m) => m + SIGNING);
      gradle = gradle.replace(
        /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
        "$1signingConfig project.hasProperty('UMPOINT_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
      );
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
