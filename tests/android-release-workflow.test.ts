import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/android-release.yml'),
  'utf8'
)

describe('Kinsay release workflow', () => {
  it('runs automatically whenever main is updated', () => {
    expect(workflow).toMatch(/push:\n\s+branches:\n\s+- main/)
  })

  it('keeps automatic main builds uniquely tagged and published as prereleases', () => {
    expect(workflow).toContain('tag=kinsay-build-$GITHUB_RUN_NUMBER')
    expect(workflow).toContain('prerelease=true')
    expect(workflow).toContain('gh release create')
  })

  it('publishes the unsigned iOS build in the same release', () => {
    expect(workflow).toContain('build-ios:')
    expect(workflow).toContain('name: Build unsigned IPA')
    expect(workflow).toContain('name: kinsay-ios-unsigned')
    expect(workflow).toContain('needs: [build, build-ios]')
  })
})
