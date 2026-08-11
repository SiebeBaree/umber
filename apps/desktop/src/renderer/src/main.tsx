import { mount } from './mount'

const container = document.querySelector<HTMLElement>('#root')

if (container === null) {
    throw new Error('Umber could not start: no #root element found in index.html')
}

mount(container)
