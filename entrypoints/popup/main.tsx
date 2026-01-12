import './style.css'
import { browser } from 'wxt/browser'

const manifest = browser.runtime.getManifest()
const version = manifest.version || '1.0.0'

const root = document.getElementById('root')!
root.innerHTML = `
  <div class="popup">
    <div class="logo-container">
        <span class="mv">MV</span><span class="premium">PREMIUM</span>
    </div>
    <div class="info">
        <span class="version">v${version}</span>
    </div>
  </div>
`
