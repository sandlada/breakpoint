import { createBreakpointObserver } from '@sandlada/breakpoint'

const currentWidth = document.getElementById('current-width')!
const customBadges = document.getElementById('custom-badges')!

const customObserver = createBreakpointObserver({
  widthBreakpoints: {
    'Mobile (<600px)': '< 600px',
    'Tablet Landscape (AND: 768-1024px)': { and: ['>= 768px', '<= 1024px'] },
    'Extreme Screens (OR: <360 or >=1920)': { or: ['< 360px', '>= 1920px'] },
    'Rem Unit (>= 50rem)': '>= 50rem',
    'Not Exact Desktop (!= 1200px)': '!= 1200px'
  }
})

customObserver.state$.subscribe((state) => {
  currentWidth.textContent = `${state.width}px`
  
  customBadges.innerHTML = Object.entries(state.widthMatches)
    .map(([label, matched]) => `
      <div class="card" style="margin-bottom: 0.5rem; padding: 0.8rem 1.2rem; display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <span>${label}</span>
        <span class="badge ${matched ? 'active' : 'inactive'}">${matched ? 'MATCHED' : 'NOT MATCHED'}</span>
      </div>
    `).join('')
})
