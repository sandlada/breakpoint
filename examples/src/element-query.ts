import { createBreakpointObserver } from '@sandlada/breakpoint'

const targetBox = document.getElementById('target-box') as HTMLElement
const boxDimension = document.getElementById('box-dimension')!
const boxBadges = document.getElementById('box-badges')!
const boxStateJson = document.getElementById('box-state-json')!
const btnAttachWindow = document.getElementById('btn-attach-window')!
const btnAttachBox = document.getElementById('btn-attach-box')!

const observer = createBreakpointObserver({
    element: targetBox
})

observer.state$.subscribe((state) => {
    boxDimension.textContent = `${state.width}px × ${state.height}px`
    boxBadges.innerHTML = state.activeWidthBreakpoints
        .map(bp => `<span class="badge active">${bp}</span>`)
        .join('') || '<span class="badge inactive">No Breakpoint</span>'

    boxStateJson.textContent = JSON.stringify({
        width: state.width,
        height: state.height,
        activeWidthBreakpoints: state.activeWidthBreakpoints,
        activeHeightBreakpoints: state.activeHeightBreakpoints,
        widthMatches: state.widthMatches
    }, null, 2)
})

btnAttachWindow.addEventListener('click', () => {
    observer.attachElement(null)
})

btnAttachBox.addEventListener('click', () => {
    observer.attachElement(targetBox)
})
