const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')

const root = resolve(__dirname, '..')
const scratch = mkdtempSync(join(tmpdir(), 'kinsay-native-passcode-'))
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status}`)
}
try {
  if (process.platform === 'darwin') {
    const binary = join(scratch, 'passcode-test')
    run('swiftc', [
      '-O',
      'modules/kinsay-passcode/ios/PasscodeDerivation.swift',
      'tests/native/passcode/main.swift',
      '-o',
      binary
    ])
    run(binary, [])
  } else {
    run('javac', [
      '-d',
      scratch,
      'modules/kinsay-passcode/android/src/main/java/expo/modules/kinsaypasscode/PasscodeDerivation.java',
      'tests/native/passcode/PasscodeDerivationTest.java'
    ])
    run('java', ['-cp', scratch, 'expo.modules.kinsaypasscode.PasscodeDerivationTest'])
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
