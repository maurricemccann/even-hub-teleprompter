import './style.css'
import { waitForEvenAppBridge, TextContainerProperty, CreateStartUpPageContainer, TextContainerUpgrade } from '@evenrealities/even_hub_sdk'

const PAGE_SIZE = 450
const PLACEHOLDER = 'Paste a script on your phone and press Send.'

function paginate(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return [PLACEHOLDER]
  const pages: string[] = []
  for (let i = 0; i < trimmed.length; i += PAGE_SIZE) pages.push(trimmed.slice(i, i + PAGE_SIZE))
  return pages
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

async function send(text: string) {
  textarea.value = text
  pages = paginate(text)
  await showPage(0)
  status.textContent = `Sent — ${pages.length} page(s) on the glasses.`
}

sendBtn.addEventListener('click', () => send(textarea.value))

// ponytail: test-only entry point — the simulator's automation API can drive
// glasses-side gestures but not phone-DOM clicks, so ?autotest=<text> exercises
// the same send() path a real tap would, for scripted acceptance testing only.
const autotest = new URLSearchParams(location.search).get('autotest')
if (autotest) send(decodeURIComponent(autotest))
