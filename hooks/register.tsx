import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionMessage } from 'claude-code'

// An alias, so it resolves on every provider (Anthropic, Bedrock, Vertex)
const MODEL = 'sonnet'
const RECENT_MESSAGES = 10
const MESSAGE_CHARS = 2000
const CONTEXT_CHARS = 12000

const hasDraft = atom({ plugin: 'cc-prompt-enhance-mod', key: 'hasDraft' } as const, false)
const isBusy = atom({ plugin: 'cc-prompt-enhance-mod', key: 'isBusy' } as const, false)
const previous = atom({ plugin: 'cc-prompt-enhance-mod', key: 'previous' } as const, null)

const SYSTEM = `You rewrite a developer's draft prompt for Claude Code into the prompt they would have written with more time and the whole session in view.
The result is sent to Claude Code as is, in place of the draft, so it has to stand on its own: a teammate who missed the conversation should be able to act on it without asking anything. Claude does its best work from a clear goal, the reason behind it, concrete references and a visible finish line, so those are what you add.

You get the recent conversation, then the draft.

<how_to_enhance>
1. Keep the author's intent, scope and language. The draft says what they want; the conversation supplies the specifics.
2. Resolve vague references ("this", "that file", "the error", "like before") to the exact path, symbol, command, error message or earlier decision the conversation points to. Put code, paths and commands in backticks.
3. State the goal plainly. When the conversation shows why it matters, add the reason in a clause: a reason lets Claude make better judgment calls than a bare rule.
4. When the conversation shows how to tell the work is done (a test, a command, an observable behavior), name it in one sentence. Claude plans its own checks, so a finish line is enough; a test plan is not needed.
5. Carry over constraints the conversation already settled, such as files to leave alone, an approach that was rejected, or a style or version to match, so Claude doesn't reopen them.
6. Write a request with several parts as a short numbered list in the order the work should happen. Keep a single ask as one or two sentences of prose.
7. Fix typos and grammar, and phrase instructions as what to do rather than what to avoid.
</how_to_enhance>

<boundaries>
- Every sentence you add traces back to the draft or the conversation. Where the draft leaves a real choice open and the conversation doesn't settle it, leave it open or turn it into a question for Claude to raise; the choice is the author's.
- Leave out filler that Claude Code already acts on by default, because it adds length and extra work without changing the result: role lines ("You are an expert..."), "think step by step", "double-check your work", "be thorough", and requests to explain its reasoning in the reply.
- Write in a calm, plain tone, without capital-letter emphasis or words like CRITICAL and MUST; Claude follows plain instructions closely and overreacts to emphasis.
- Let the length follow the content: a resolved one-liner can stay one line, and a vague multi-part draft can grow into a short list. A draft that is already specific comes back with only typo fixes.
</boundaries>

<output_format>
Output only the enhanced prompt, in the author's voice, as the message they will send: no preamble, no explanation, no quotes, and no code fence around it.
</output_format>

<examples>
<example>
<conversation>
[user] run the tests
(tools: Bash python -m pytest)

[assistant] 1 failed: tests/test_users.py::TestUsers::test_create_user raised KeyError: 'mail' at app/users.py:2, where create_user reads data['mail'] but the test posts 'email'.
</conversation>
<draft>
fix that error so the test pases
</draft>
<enhanced>
Fix the \`KeyError: 'mail'\` in \`create_user\` at \`app/users.py:2\`: it reads \`data['mail']\` but the test posts \`email\`. Done means \`tests/test_users.py::TestUsers::test_create_user\` passes under \`python -m pytest\`.
</enhanced>
</example>

<example>
<conversation>
[user] the settings page takes ages to load
(tools: Read src/pages/Settings.tsx; Read src/api/prefs.ts)

[assistant] SettingsPage in src/pages/Settings.tsx calls fetchUserPrefs once per toggle on mount, 14 requests in all. src/api/prefs.ts already has fetchPrefsBatch, which hits GET /api/prefs?keys= in one request.

[user] don't touch anything under src/api, the backend team owns it
</conversation>
<draft>
ok fix it and add a test
</draft>
<enhanced>
Make \`SettingsPage\` in \`src/pages/Settings.tsx\` load faster. It currently calls \`fetchUserPrefs\` once per toggle on mount, 14 requests in all.
1. Load all preferences in one request with the existing \`fetchPrefsBatch\` from \`src/api/prefs.ts\`.
2. Add a test that shows the page makes a single preferences request on mount.

Leave everything under \`src/api\` as it is; the backend team owns it.
</enhanced>
</example>

<example>
<conversation>
[user] añade exportación a CSV en la tabla de pedidos
(tools: Read src/components/OrdersTable.vue)

[assistant] La tabla está en src/components/OrdersTable.vue. ¿Exporto solo las filas filtradas o todas?
</conversation>
<draft>
solo las filtradas, con un boton igual al de imprimir
</draft>
<enhanced>
Añade la exportación a CSV en \`src/components/OrdersTable.vue\`, exportando solo las filas que quedan tras aplicar los filtros actuales. Usa un botón con el mismo estilo y ubicación que el botón de imprimir de esa tabla.
</enhanced>
</example>

<example>
<conversation>
(none yet)
</conversation>
<draft>
Rename getUser to fetchUser in src/api/users.ts and update every caller.
</draft>
<enhanced>
Rename \`getUser\` to \`fetchUser\` in \`src/api/users.ts\` and update every caller.
</enhanced>
</example>
</examples>`

// The one gate for enhancing: two or more words and ten or more characters
export const isEnhanceable = (text: string) => text.trim().split(/\s+/).length >= 2 && text.trim().length >= 10

// The button shows for any draft, so a short one gets the error instead of nothing
const hasText = (text: string) => text.trim() !== ''

// The hue wheel walked one level at a time along the edges of the xterm
// 256-color cube, so neighbors blend and a 256-color terminal shows the same
// colors as a truecolor one instead of rounding a gradient into uneven steps
const UP = [0, 95, 135, 175, 215]
const DOWN = [255, 215, 175, 135, 95]
const WHEEL = [
  ...UP.map(v => [255, v, 0]), // red to yellow
  ...DOWN.map(v => [v, 255, 0]), // yellow to green
  ...UP.map(v => [0, 255, v]), // green to cyan
  ...DOWN.map(v => [0, v, 255]), // cyan to blue
  ...UP.map(v => [v, 0, 255]), // blue to magenta
  ...DOWN.map(v => [255, 0, v]), // magenta back to red
]

// WCAG relative luminance of an [r, g, b] color
const luminance = (rgb: number[]) => {
  const [r = 0, g = 0, b = 0] = rgb.map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Each background with black or white text, whichever contrasts more
const RAINBOW = WHEEL.map(rgb => {
  const l = luminance(rgb)
  return {
    backgroundColor: '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join(''),
    color: (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? '#000000' : '#ffffff',
  }
})
const FRAME_MS = 100

// One background per character, shifted one step right each frame
// ponytail: one decoration per character, group runs if long drafts lag
export const rainbow = (text: string, frame: number) =>
  Array.from({ length: text.length }, (_, i) => ({
    start: i,
    end: i + 1,
    ...RAINBOW[(i - (frame % RAINBOW.length) + RAINBOW.length) % RAINBOW.length],
  }))

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max) + '…' : text)

const describe = (m: SessionMessage) => {
  const tools = m.toolUses.map(u => {
    const target = u.input.file_path ?? u.input.command ?? u.input.path
    return typeof target === 'string' ? `${u.tool} ${clip(target, 200)}` : u.tool
  })
  const text = clip(m.text, MESSAGE_CHARS)
  return `[${m.role}] ${text}${tools.length ? `\n(tools: ${tools.join('; ')})` : ''}`
}

const conversation = async ($: EngineInterface) => {
  const rows = (await $.session.messages()).filter(m => m.text.trim() !== '').slice(-RECENT_MESSAGES)
  const text = rows.map(describe).join('\n\n')
  return text.length > CONTEXT_CHARS ? '…' + text.slice(-CONTEXT_CHARS) : text
}

const unfence = (text: string) => text.trim().replace(/^```[^\n]*\n([\s\S]*?)\n```$/, '$1').trim()

const enhance = async ($: EngineInterface) => {
  if (await read($, isBusy)) return
  const draft = (await $.prompt.read()).text
  if (!isEnhanceable(draft)) {
    // The next edit's answer carries no decorations, so the red clears itself
    await $.prompt.fill({ text: draft, decorations: [{ start: 0, end: draft.length, backgroundColor: 'red' }] })
    $.ui.toast('This prompt is too short to enhance')
    return
  }
  await update($, isBusy, () => true)
  try {
    let isDone = false
    // Repaints only while the box still holds the draft, so typing stops it
    // ponytail: a key typed between the read and the fill is lost, a paint-only API would fix it
    const painting = (async () => {
      for (let frame = 0; !isDone; frame++) {
        if ((await $.prompt.read()).text === draft) await $.prompt.fill({ text: draft, decorations: rainbow(draft, frame) })
        await $.clock.sleep(FRAME_MS)
      }
    })()

    const r = await $.model.complete({
      model: MODEL,
      system: SYSTEM,
      prompt: `<conversation>\n${(await conversation($)) || '(none yet)'}\n</conversation>\n\n<draft>\n${draft}\n</draft>`,
      maxTokens: 4096,
      timeoutMs: 60000,
    }).finally(() => {
      // Stopped before the result lands, so no late frame paints over it
      isDone = true
      return painting
    })
    if (!r.isAnswered) {
      const detail = r.reason === 'api-error' ? ` (${r.status ?? 'no response'}, ${r.error})` : ''
      $.ui.toast(`Enhance failed: ${r.reason}${detail}`)
      return
    }

    const text = unfence(r.text)
    if ((await $.prompt.read()).text !== draft) {
      $.ui.toast('Draft changed while enhancing; kept your version')
      return
    }
    const filled = await $.prompt.fill({ text, mode: 'replace' })
    if (!filled.isFilled) {
      $.ui.toast('Could not replace the draft')
      return
    }
    await update($, previous, () => draft)
    await update($, hasDraft, () => hasText(filled.text))
  } finally {
    // Clears the rainbow on every path that left the draft in the box
    if ((await $.prompt.read()).text === draft) await $.prompt.fill({ text: draft })
    await update($, isBusy, () => false)
  }
}

const revert = async ($: EngineInterface) => {
  const text = await read($, previous)
  if (text === null) return
  const filled = await $.prompt.fill({ text, mode: 'replace' })
  if (!filled.isFilled) return
  await update($, previous, () => null)
  await update($, hasDraft, () => hasText(text))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const text = (await $.prompt.read()).text
    await update($, hasDraft, () => hasText(text))
    return next(e)
  })

  on('prompt.edit', async ($, e, next) => {
    const r = await next(e)
    if (r.text === e.text) return r
    const draft = hasText(r.text)
    if (draft !== (await read($, hasDraft))) {
      await update($, hasDraft, () => draft)
    }
    // Editing the enhanced text accepts it: the next press enhances again
    if ((await read($, previous)) !== null) {
      await update($, previous, () => null)
    }
    return r
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'composer') {
      await update($, hasDraft, () => false)
      await update($, previous, () => null)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const busy = await read($, isBusy)
    const draft = await read($, hasDraft)
    // Revert stays reachable even if the enhanced text is blank
    const canRevert = (await read($, previous)) !== null
    if (e.props.hasSurvey || (!busy && !draft && !canRevert)) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    if (busy) {
      return (
        <Box>
          <Text dimColor>Enhancing with Sonnet…</Text>
        </Box>
      )
    }

    // ctrl+e is bound to this action in ~/.claude/keybindings.json
    const shortcut = e.surface === 'terminal' ? ' ⌃E' : ''
    return (
      <Box>
        <Button
          key="enhance"
          label={(canRevert ? 'Revert' : 'Enhance') + shortcut}
          hotkey="e"
          action="app:cycleDiffBase"
          variant={canRevert ? 'secondary' : 'primary'}
          onPress={() => (canRevert ? revert($) : enhance($))}
        />
      </Box>
    )
  })
}
