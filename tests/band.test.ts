import { describe, expect, test } from 'claude-code/testing'

const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 9 },
  view: {},
}

const SURFACES = ['terminal', 'desktop'] as const

// prompt.edit comes only from the composer and $.model.complete is no event,
// so the kit can't drive a draft or a reply: this covers the empty-box path.
describe('cc-prompt-enhance-mod band', () => {
  for (const surface of SURFACES) {
    test(`leaves the band to the engine while the box is empty (${surface})`, async ($, on) => {
      on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)
        return Text({ children: 'engine band' })
      })
      on('prompt.submit', ($, e) => ({ text: e.text }))
      const mount = () => $.ui.mount({ plugin: 'cc-prompt-enhance-mod', surface, component: 'AbovePrompt', props: BAND })

      const empty = await mount()
      expect(await empty.find({ key: 'enhance' })).toBeUndefined()
      await empty.unmount()

      await $.prompt.submit({ text: 'fix the failing test', wait: false, origin: { kind: 'composer' } })
      const sent = await mount()
      expect(await sent.find({ key: 'enhance' })).toBeUndefined()
    })
  }
})
