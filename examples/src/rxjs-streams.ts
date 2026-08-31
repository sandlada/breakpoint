import { observeWidthBreakpoint } from '@sandlada/breakpoint'
import { Subscription } from 'rxjs'
import { map, tap } from 'rxjs/operators'

const btnSub = document.getElementById('btn-sub')!
const btnUnsub = document.getElementById('btn-unsub')!
const subStatus = document.getElementById('sub-status')!
const streamVal = document.getElementById('stream-val')!
const logBox = document.getElementById('log-box')!

let sub: Subscription | null = null

function addLog(msg: string) {
  const item = document.createElement('div')
  item.className = 'log-item'
  const time = new Date().toLocaleTimeString()
  item.innerHTML = `<span class="time">[${time}]</span> ${msg}`
  logBox.prepend(item)
}

function startSubscription() {
  if (sub) return
  
  const isLarge$ = observeWidthBreakpoint('>= 800px').pipe(
    tap(matched => addLog(`流推送新值: ${matched}`)),
    map(matched => (matched ? 'TRUE (>=800px)' : 'FALSE (<800px)'))
  )

  sub = isLarge$.subscribe((val) => {
    streamVal.textContent = val
  })

  subStatus.className = 'badge active'
  subStatus.textContent = '已订阅 (Active)'
  addLog('已建立 RxJS 订阅')
}

function stopSubscription() {
  if (sub) {
    sub.unsubscribe()
    sub = null
    subStatus.className = 'badge inactive'
    subStatus.textContent = '已退订 (Cleaned)'
    streamVal.textContent = 'Disconnected'
    addLog('已退订，所有底层资源已自动释放')
  }
}

btnSub.addEventListener('click', startSubscription)
btnUnsub.addEventListener('click', stopSubscription)

startSubscription()
