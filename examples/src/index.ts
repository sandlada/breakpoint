import { createBreakpointObserver } from '@sandlada/breakpoint'

const widthEl = document.getElementById('viewport-width')!
const activeEl = document.getElementById('active-breakpoint')!
const badgesEl = document.getElementById('breakpoint-badges')!
const stateJsonEl = document.getElementById('state-json')!
const btnSnapshot = document.getElementById('btn-snapshot')!

const observer = createBreakpointObserver()

observer.state$.subscribe((state) => {
  widthEl.textContent = `${state.width}px`
  activeEl.textContent = state.activeWidthBreakpoints.join(', ') || 'none'
  
  badgesEl.innerHTML = Object.entries(state.widthMatches)
    .map(([name, matched]) => `
      <span class="badge ${matched ? 'active' : 'inactive'}">
        ${name}: ${matched ? 'MATCH' : 'OFF'}
      </span>
    `).join('')

  stateJsonEl.textContent = JSON.stringify(state, null, 2)
})

btnSnapshot.addEventListener('click', () => {
  const snap = observer.snapshot
  alert('当前同步 Snapshot: ' + JSON.stringify(snap, null, 2))
})
