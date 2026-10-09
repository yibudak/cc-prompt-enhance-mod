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

// $.model.complete is no event, so the kit can't drive a reply: these cover
// when the button shows, not what pressing it does.
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

    test(`shows the button only for a draft that passes the gate (${surface})`, async ($, on) => {
      on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)
        return Text({ children: 'engine band' })
      })
      on('prompt.edit', ($, e) => ({
        text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end),
        cursor: e.start + e.inputText.length,
      }))
      const mount = () => $.ui.mount({ plugin: 'cc-prompt-enhance-mod', surface, component: 'AbovePrompt', props: BAND })
      const type = (before: string, text: string) =>
        // @ts-expect-error The kit raises prompt.edit as the composer does, but its $ type leaves it out
        $.prompt.edit({ origin: { kind: 'composer' }, text: before, cursor: before.length, start: 0, end: before.length, inputText: text })

      await type('', 'A')
      const short = await mount()
      expect(await short.find({ key: 'enhance' })).toBeUndefined()
      await short.unmount()

      await type('A', 'fix the bug')
      const long = await mount()
      expect(await long.find({ key: 'enhance', text: /^Enhance/ })).toBeDefined()
    })
  }
})
