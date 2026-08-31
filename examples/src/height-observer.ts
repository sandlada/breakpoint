import { createBreakpointObserver } from '@sandlada/breakpoint'

const vWidth = document.getElementById('v-width')!
const vHeight = document.getElementById('v-height')!
const widthBadges = document.getElementById('width-badges')!
const heightBadges = document.getElementById('height-badges')!

const observer = createBreakpointObserver()

observer.state$.subscribe((state) => {
  vWidth.textContent = `${state.width}px`
  vHeight.textContent = `${state.height}px`

  widthBadges.innerHTML = Object.entries(state.widthMatches)
    .map(([k, v]) => `<span class="badge ${v ? 'active' : 'inactive'}">${k}</span>`)
    .join('')

  heightBadges.innerHTML = Object.entries(state.heightMatches)
    .map(([k, v]) => `<span class="badge ${v ? 'active' : 'inactive'}" style="${v ? 'background: rgba(192, 132, 252, 0.2); color: #c084fc; border-color: rgba(192, 132, 252, 0.5);' : ''}">${k}</span>`)
    .join('')
})
