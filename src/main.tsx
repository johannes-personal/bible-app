import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Root from './Root.tsx'
import { isIOS } from './device'
import { registerServiceWorker } from './offline/register'

registerServiceWorker()

// iPhones and iPads zoom in when a text box is focused, and the search box focuses as it opens.
// "maximum-scale=1" stops that zoom; iOS still lets people pinch to zoom. Other systems keep
// the plain viewport, so their pinch zoom is untouched.
if (isIOS()) {
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1, viewport-fit=cover')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
