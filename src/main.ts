import './style.css'
import seedsData from './seeds.json'
import { waitForEvenAppBridge, TextContainerProperty, CreateStartUpPageContainer, TextContainerUpgrade } from '@evenrealities/even_hub_sdk'

const PAGE_SIZE = 450
const PLACEHOLDER = 'Paste a script on your phone and press Send.'

type Seed = { glyph: string; phrase: string; tag: string }
const seeds = seedsData as Seed[]

const THREE_TRUTHS = [
  'Prepared for luxury.',
  'You are in control of your reality.',
  'What persists in the mind becomes your reality.',
  'Watch this.',
].join('\n\n')

type Mode = 'scroll' | 'flashcard'
let mode: Mode = 'scroll'

function paginateScroll(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return [PLACEHOLDER]
  const pages: string[] = []
  for (let i = 0; i < trimmed.length; i += PAGE_SIZE) pages.push(trimmed.slice(i, i + PAGE_SIZE))
  return pages
}

// One idea per card — split on blank lines, never mid-sentence like the fixed
// char-count scroll pagination would.
function paginateFlashcard(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return [PLACEHOLDER]
  const cards = trimmed.split(/\n\s*\n/).map(c => c.trim()).filter(Boolean)
  return cards.length ? cards : [trimmed]
}

function paginate(text: string): string[] {
  return mode === 'flashcard' ? paginateFlashcard(text) : paginateScroll(text)
}

const bridge = await waitForEvenAppBridge()

let pages = paginate('')
let pageIndex = 0

const mainText = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 288,
  borderWidth: 0,
  borderColor: 15,
  paddingLength: 4,
  containerID: 1,
  containerName: 'main',
  content: pages[0],
  isEventCapture: 1,
})

await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
  containerTotalNum: 1,
  textObject: [mainText],
}))

async function showPage(index: number) {
  pageIndex = Math.max(0, Math.min(index, pages.length - 1))
  await bridge.textContainerUpgrade(new TextContainerUpgrade({
    containerID: 1,
    containerName: 'main',
    content: pages[pageIndex],
    contentOffset: 0,
    contentLength: 0,
  }))
}

bridge.onEvenHubEvent((event: any) => {
  if (event.textEvent) {
    const type = event.textEvent.eventType ?? 0
    if (type === 1) showPage(pageIndex - 1) // swipe up — back
    if (type === 2) showPage(pageIndex + 1) // swipe down — advance
  }
})

const textarea = document.querySelector<HTMLTextAreaElement>('#script')!
const sendBtn = document.querySelector<HTMLButtonElement>('#send')!
const status = document.querySelector<HTMLParagraphElement>('#status')!
const scrollBtn = document.querySelector<HTMLButtonElement>('#mode-scroll')!
const flashcardBtn = document.querySelector<HTMLButtonElement>('#mode-flashcard')!
const truthsBtn = document.querySelector<HTMLButtonElement>('#preset-truths')!
const seedBtn = document.querySelector<HTMLButtonElement>('#preset-seed')!

async function send(text: string) {
  textarea.value = text
  pages = paginate(text)
  await showPage(0)
  status.textContent = `Sent — ${pages.length} ${mode === 'flashcard' ? 'card(s)' : 'page(s)'} on the glasses.`
}

function setMode(m: Mode) {
  mode = m
  scrollBtn.classList.toggle('active', m === 'scroll')
  flashcardBtn.classList.toggle('active', m === 'flashcard')
}

scrollBtn.addEventListener('click', () => setMode('scroll'))
flashcardBtn.addEventListener('click', () => setMode('flashcard'))
sendBtn.addEventListener('click', () => send(textarea.value))
truthsBtn.addEventListener('click', () => { setMode('flashcard'); send(THREE_TRUTHS) })
seedBtn.addEventListener('click', () => {
  setMode('scroll')
  const seed = seeds[Math.floor(Math.random() * seeds.length)]
  send(seed.phrase)
})

// ponytail: test-only entry point — the simulator's automation API can drive
// glasses-side gestures but not phone-DOM clicks, so ?autotest=<text> exercises
// the same send() path a real tap would, for scripted acceptance testing only.
const testParams = new URLSearchParams(location.search)
const autotest = testParams.get('autotest')
if (autotest) {
  if (testParams.get('mode') === 'flashcard') setMode('flashcard')
  send(decodeURIComponent(autotest))
} else if (testParams.get('preset') === 'truths') {
  setMode('flashcard')
  send(THREE_TRUTHS)
} else if (testParams.get('preset') === 'seed') {
  setMode('scroll')
  const seed = seeds[Math.floor(Math.random() * seeds.length)]
  send(seed.phrase)
}
